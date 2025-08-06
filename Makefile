all: build run

delete: 
	rm -rf bin
	rm -rf dist

build:
	$(MAKE) delete
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/wekalist-linux main.go
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o bin/wekalist-windows.exe main.go
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -o bin/wekalist-darwin main.go   

run:
	./bin/wekalist --port 5230 --mode dev

publish:
	$(MAKE) delete
	goreleaser release

ensure-compile-daemon:
	@which go > /dev/null || (echo "Error: Go is not installed or not in PATH" && exit 1)
	@which CompileDaemon > /dev/null || (echo "Installing CompileDaemon..." && go install github.com/githubnemo/CompileDaemon@latest)

help:
	@echo "Makefile commands:"
	@echo "  all: Build and run the application"
	@echo "  delete: Remove build artifacts"
	@echo "  build: Compile the application"
	@echo "  run: Execute the compiled application"
	@echo "  dev: Start development mode with hot reloading"
	@echo "  ensure-compile-daemon: Ensure CompileDaemon is installed"
	@echo "  help: Display this help message"

client:
	cd web && pnpm dev

serve:
	CompileDaemon -build="go build -o ./bin/wekalist main.go" -command="./bin/wekalist --mode dev --port 8081"

dev:
	$(MAKE) client
	$(MAKE) serve
