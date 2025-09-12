import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Bookmark } from "@shared/schema";

// Form validation schema
const passcodeFormSchema = z.object({
  passcode: z.string()
    .min(4, "Passcode must be at least 4 characters long")
    .max(64, "Passcode must be no more than 64 characters long"),
});

type PasscodeFormData = z.infer<typeof passcodeFormSchema>;

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark?: Bookmark;
  onSuccess: (passcode: string) => void;
}

export function PasscodeModal({ isOpen, onClose, bookmark, onSuccess }: PasscodeModalProps) {
  const { toast } = useToast();
  const [submitError, setSubmitError] = useState<string>("");

  const form = useForm<PasscodeFormData>({
    resolver: zodResolver(passcodeFormSchema),
    defaultValues: {
      passcode: "",
    },
  });

  // Clear form and errors when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset({ passcode: "" });
      setSubmitError("");
      // Auto-focus on passcode input
      setTimeout(() => {
        const input = document.getElementById('passcode-input');
        if (input) {
          input.focus();
        }
      }, 100);
    } else {
      form.reset({ passcode: "" });
      setSubmitError("");
    }
  }, [isOpen, form]);

  // Clear errors when user starts typing
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'passcode' && submitError) {
        setSubmitError("");
      }
    });
    return () => subscription.unsubscribe();
  }, [form, submitError]);

  const verifyPasscodeMutation = useMutation({
    mutationFn: async (data: PasscodeFormData) => {
      if (!bookmark?.id) {
        throw new Error("Bookmark ID is required");
      }

      const response = await apiRequest("POST", `/api/bookmarks/${bookmark.id}/verify-passcode`, {
        passcode: data.passcode,
      });

      return await response.json() as { valid: boolean };
    },
    onSuccess: (data) => {
      if (data.valid) {
        const passcode = form.getValues("passcode");
        toast({
          description: "Access granted! Opening bookmark...",
        });
        onSuccess(passcode);
        handleClose();
      } else {
        setSubmitError("Incorrect passcode. Please try again.");
        form.setFocus("passcode");
      }
    },
    onError: (error: any) => {
      console.error("Passcode verification error:", error);
      
      // Handle different types of errors
      if (error.message?.includes("Too many")) {
        setSubmitError("Too many attempts. Please wait 15 minutes before trying again.");
      } else if (error.message?.includes("rate limit") || error.status === 429) {
        setSubmitError("Too many passcode attempts. Please wait before trying again.");
      } else if (error.message?.includes("Bookmark not found")) {
        setSubmitError("This bookmark no longer exists.");
      } else if (error.message?.includes("Invalid passcode format")) {
        setSubmitError("Invalid passcode format. Please check your input.");
      } else if (error.message?.includes("network") || error.code === 'NETWORK_ERROR') {
        setSubmitError("Network error. Please check your connection and try again.");
      } else {
        setSubmitError("Unable to verify passcode. Please try again.");
      }

      toast({
        variant: "destructive",
        description: "Failed to verify passcode",
      });
    }
  });

  const handleClose = () => {
    form.reset({ passcode: "" });
    setSubmitError("");
    onClose();
  };

  const onSubmit = (data: PasscodeFormData) => {
    setSubmitError("");
    verifyPasscodeMutation.mutate(data);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !verifyPasscodeMutation.isPending) {
      e.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  if (!bookmark) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-testid="modal-passcode">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="modal-title-passcode">
            <Lock size={20} className="text-muted-foreground" />
            Protected Bookmark
          </DialogTitle>
          <DialogDescription data-testid="modal-description-passcode">
            Enter the passcode to access "{bookmark.name}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="passcode-input" className="text-sm font-medium">
              Passcode
            </Label>
            <Input
              id="passcode-input"
              type="password"
              placeholder="Enter passcode"
              {...form.register("passcode")}
              onKeyDown={handleKeyDown}
              disabled={verifyPasscodeMutation.isPending}
              data-testid="input-passcode-verify"
              autoComplete="off"
            />
            {form.formState.errors.passcode && (
              <p className="text-sm text-destructive" data-testid="error-passcode-format">
                {form.formState.errors.passcode.message}
              </p>
            )}
            {submitError && (
              <p className="text-sm text-destructive" data-testid="error-passcode-verify">
                {submitError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={verifyPasscodeMutation.isPending}
              data-testid="button-cancel-passcode"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={verifyPasscodeMutation.isPending || !form.watch("passcode")}
              data-testid="button-verify-passcode"
            >
              {verifyPasscodeMutation.isPending ? "Verifying..." : "Unlock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}