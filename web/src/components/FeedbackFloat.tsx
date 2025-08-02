import { useState } from "react";
import { MessageCircle, X, Bug, Heart, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import useCurrentUser from "@/hooks/useCurrentUser";
import { User_Role } from "@/types/proto/api/v1/user_service";

export default function FeedbackFloat() {
    const user = useCurrentUser();
    const showFeedbackFloat = (user?.role===User_Role.HOST || user?.role===User_Role.ADMIN);
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [feedbackType, setFeedbackType] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [message, setMessage] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const handleSubmit = async () => {
        if (!feedbackType || !message.trim()) {
            toast.error("Please select feedback type and enter a message");
            return;
        }

        setIsSubmitting(true);
        try {
            // Simulate API call - replace with actual endpoint
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            toast.success("Thank you for your feedback! We'll review it shortly.");
            
            // Reset form
            setFeedbackType("");
            setEmail("");
            setMessage("");
            setIsExpanded(false);
        } catch (error) {
            toast.error("Failed to submit feedback. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setIsExpanded(false);
        setFeedbackType("");
        setEmail("");
        setMessage("");
    };
    
    return (
        <>
            {showFeedbackFloat && (
                <div className="fixed bottom-4 right-4 z-50">
                    {!isExpanded ? (
                        <Button
                            onClick={() => setIsExpanded(true)}
                            className="rounded-full h-12 w-12 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200 group"
                            size="icon"
                        >
                            <MessageCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        </Button>
                    ) : (
                        <div className="bg-background border border-border rounded-lg shadow-2xl w-80 max-h-96 overflow-hidden animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">Send Feedback</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleClose}
                                    className="h-8 w-8 hover:bg-muted"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-4 max-h-80 overflow-y-auto no_scrollbar">
                                <div className="space-y-2">
                                    <Label htmlFor="feedback-type" className="text-sm font-medium">
                                        What would you like to share?
                                    </Label>
                                    <Select value={feedbackType} onValueChange={setFeedbackType}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select feedback type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="bug">
                                                <div className="flex items-center gap-2">
                                                    <Bug className="h-4 w-4 text-red-500" />
                                                    Bug Report
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="feature">
                                                <div className="flex items-center gap-2">
                                                    <Heart className="h-4 w-4 text-blue-500" />
                                                    Feature Request
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="improvement">
                                                <div className="flex items-center gap-2">
                                                    <MessageCircle className="h-4 w-4 text-green-500" />
                                                    Improvement
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="other">
                                                <div className="flex items-center gap-2">
                                                    <MessageCircle className="h-4 w-4 text-gray-500" />
                                                    Other
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-sm font-medium">
                                        Email (optional)
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="your@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        We'll only use this to follow up if needed
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="message" className="text-sm font-medium">
                                        Message
                                    </Label>
                                    <Textarea
                                        id="message"
                                        placeholder={
                                            feedbackType === "bug" 
                                                ? "Describe the bug, steps to reproduce, and expected behavior..."
                                                : feedbackType === "feature"
                                                ? "Describe the feature you'd like to see..."
                                                : "Tell us what's on your mind..."
                                        }
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={4}
                                        className="w-full resize-none"
                                    />
                                </div>

                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !feedbackType || !message.trim()}
                                    className="w-full"
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                                            Sending...
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Send className="h-4 w-4" />
                                            Send Feedback
                                        </div>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}