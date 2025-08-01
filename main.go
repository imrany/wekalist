package main

import (
    "context"
    "fmt"
    "log/slog"
    "net/http"
    "os"
    "os/signal"
    "syscall"

    "github.com/joho/godotenv"
    "github.com/spf13/cobra"
    "github.com/spf13/viper"

    "github.com/usememos/memos/internal/profile"
    "github.com/usememos/memos/internal/version"
    "github.com/usememos/memos/server"
    "github.com/usememos/memos/store"
    "github.com/usememos/memos/store/db"
)

const greetingBanner = `
███╗   ███╗███████╗███╗   ███╗ ██████╗ ███████╗
████╗ ████║██╔════╝████╗ ████║██╔═══██╗██╔════╝
██╔████╔██║█████╗  ██╔████╔██║██║   ██║███████╗
██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██║   ██║╚════██║
██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║╚██████╔╝███████║
╚═╝     ╚═╝╚══════╝╚═╝     ╚╝ ╚═════╝ ╚══════╝
`

var rootCmd = &cobra.Command{
    Use:   "memos",
    Short: "An open source, lightweight note-taking service",
    Run:   runServer,
}

func runServer(_ *cobra.Command, _ []string) {
    profile := &profile.Profile{
        Mode:                 viper.GetString("mode"),
        Addr:                 viper.GetString("addr"),
        Port:                 viper.GetInt("port"),
        UNIXSock:             viper.GetString("unix-sock"),
        Data:                 viper.GetString("data"),
        Driver:               viper.GetString("driver"),
        DSN:                  viper.GetString("dsn"),
        InstanceURL:          viper.GetString("instance-url"),
        Version:              version.GetCurrentVersion(viper.GetString("mode")),
    }

    if err := profile.Validate(); err != nil {
        slog.Error("invalid configuration", "error", err)
        os.Exit(1)
    }

    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    dbDriver, err := db.NewDBDriver(profile)
    if err != nil {
        slog.Error("failed to initialize database", "error", err)
        return
    }

    storeInstance := store.New(dbDriver, profile)
    if err := storeInstance.Migrate(ctx); err != nil {
        slog.Error("failed to migrate store", "error", err)
        return
    }

    serverInstance, err := server.NewServer(ctx, profile, storeInstance)
    if err != nil {
        slog.Error("failed to create server", "error", err)
        return
    }

    printGreetings(profile)

    stop := make(chan os.Signal, 1)
    signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

    go func() {
        <-stop
        slog.Info("shutting down...")
        serverInstance.Shutdown(ctx)
        cancel()
    }()

    if err := serverInstance.Start(ctx); err != nil && err != http.ErrServerClosed {
        slog.Error("server error", "error", err)
    }
    <-ctx.Done()
}

func printGreetings(p *profile.Profile) {
    fmt.Print(greetingBanner)
    fmt.Printf("🚀 Starting Memos v%s\n", p.Version)
    fmt.Println("---")

    if p.UNIXSock != "" {
        fmt.Printf("🔌 Unix socket: %s\n", p.UNIXSock)
    } else {
        fmt.Printf("🌐 Listening on: %s:%d\n", p.Addr, p.Port)
    }

    fmt.Printf("🗂️  Data Directory: %s\n", p.Data)
    fmt.Printf("🛠️  DB Driver: %s\n", p.Driver)
    fmt.Printf("🔗 Instance URL: %s\n", p.InstanceURL)
    fmt.Println("---")
    fmt.Println("📚 Documentation: https://usememos.com/docs")
    fmt.Println("🔗 GitHub:        https://github.com/usememos/memos")
    fmt.Println("---")
}

func init() {
    // Load .env file first
    if err := godotenv.Load(); err != nil {
        slog.Warn("No .env file found or failed to load", "error", err)
    }

    viper.AutomaticEnv()

    envBindings := map[string]string{
            "mode": "MODE",
            "addr": "ADDR",
            "port": "PORT",
            "unix-sock": "UNIX_SOCK",
            "data": "DATA",
            "driver": "DRIVER",
            "dsn": "DSN",
            "instance-url": "INSTANCE_URL",
    }

    for key, env := range envBindings {
        if err := viper.BindEnv(key, env); err != nil {
            panic(fmt.Errorf("failed to bind env var '%s': %w", key, err))
        }
    }

    rootCmd.PersistentFlags().String("mode", "dev", "Server mode")
    rootCmd.PersistentFlags().String("addr", "0.0.0.0", "Bind address")
    rootCmd.PersistentFlags().Int("port", 8081, "Port")
    rootCmd.PersistentFlags().String("unix-sock", "", "Unix socket")
    rootCmd.PersistentFlags().String("data", "", "Data directory")
    rootCmd.PersistentFlags().String("driver", "sqlite", "Database driver")
    rootCmd.PersistentFlags().String("dsn", "", "Data source name")
    rootCmd.PersistentFlags().String("instance-url", "", "Instance URL")

    for key := range envBindings {
        if err := viper.BindPFlag(key, rootCmd.PersistentFlags().Lookup(key)); err != nil {
            panic(fmt.Errorf("failed to bind flag '%s': %w", key, err))
        }
    }
}

func main() {
    if err := rootCmd.Execute(); err != nil {
        slog.Error("failed to run command", "error", err)
        os.Exit(1)
    }
}
