import React from "react";
import { Loader, RefreshCcw, CircleDashed, Hourglass, Sparkles, RotateCcw, FileSearch, Hammer, Briefcase, FileText, Calculator, Monitor, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "spinner" | "dots" | "skeleton" | "pulse" | "progress" | "shimmer" | "hourglass" | "sparkle" | "typing" | "working" | "calculating" | "searching" | "coding";
  size?: "sm" | "md" | "lg";
  text?: string;
  fullPage?: boolean;
}

export function Loading({
  variant = "spinner",
  size = "md",
  text,
  className,
  fullPage = false,
  ...props
}: LoadingProps) {
  // Size mapping
  const sizeMap = {
    sm: {
      icon: "h-4 w-4",
      container: "h-8 w-8",
      text: "text-xs",
      skeleton: "h-4",
    },
    md: {
      icon: "h-6 w-6",
      container: "h-12 w-12",
      text: "text-sm",
      skeleton: "h-6",
    },
    lg: {
      icon: "h-8 w-8",
      container: "h-16 w-16",
      text: "text-base",
      skeleton: "h-8",
    },
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    if (fullPage) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center space-y-4">
            {children}
          </div>
        </div>
      );
    }
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center space-y-2",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  };

  const renderLoading = () => {
    switch (variant) {
      case "spinner":
        return (
          <Wrapper>
            <div className={cn("animate-spin text-primary", sizeMap[size].icon)}>
              <Loader />
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text}</p>}
          </Wrapper>
        );

      case "dots":
        return (
          <Wrapper>
            <div className="flex space-x-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full bg-primary",
                    sizeMap[size].icon.includes("h-4") ? "h-2 w-2" : "",
                    sizeMap[size].icon.includes("h-6") ? "h-3 w-3" : "",
                    sizeMap[size].icon.includes("h-8") ? "h-4 w-4" : "",
                    "animate-pulse",
                    `animation-delay-${i * 200}`
                  )}
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text}</p>}
          </Wrapper>
        );

      case "skeleton":
        return (
          <Wrapper>
            <div className="w-full space-y-2">
              <Skeleton className={cn("w-full", sizeMap[size].skeleton)} />
              <Skeleton className={cn("w-full", sizeMap[size].skeleton)} />
              <Skeleton className={cn("w-3/4", sizeMap[size].skeleton)} />
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text}</p>}
          </Wrapper>
        );

      case "pulse":
        return (
          <Wrapper>
            <div className={cn("rounded-full bg-primary/30 p-3", sizeMap[size].container)}>
              <div className="h-full w-full animate-pulse rounded-full bg-primary" />
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text}</p>}
          </Wrapper>
        );

      case "progress":
        return (
          <Wrapper>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-primary/20">
              <div className="h-full w-full animate-progress-indeterminate bg-primary" />
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text}</p>}
          </Wrapper>
        );
      
      case "shimmer":
        return (
          <Wrapper>
            <div className="flex flex-col gap-2 w-full">
              <div className="h-16 w-full rounded-md bg-muted overflow-hidden relative">
                <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </div>
              <div className="h-8 w-3/4 rounded-md bg-muted overflow-hidden relative">
                <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </div>
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text}</p>}
          </Wrapper>
        );
      
      case "hourglass":
        return (
          <Wrapper>
            <div className={cn("animate-bounce text-primary", sizeMap[size].icon)}>
              <Hourglass />
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text}</p>}
          </Wrapper>
        );
      
      case "sparkle":
        return (
          <Wrapper>
            <div className="relative">
              <div className={cn("animate-spin text-primary", sizeMap[size].icon)}>
                <CircleDashed />
              </div>
              <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary", 
                sizeMap[size].icon.includes("h-4") ? "h-3 w-3" : "",
                sizeMap[size].icon.includes("h-6") ? "h-4 w-4" : "",
                sizeMap[size].icon.includes("h-8") ? "h-6 w-6" : "",
              )}>
                <Sparkles className="animate-pulse" />
              </div>
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text}</p>}
          </Wrapper>
        );

      case "typing":
        return (
          <Wrapper>
            <div className="flex items-center space-x-2">
              <div className={cn("text-primary", sizeMap[size].icon)}>
                <PenTool />
              </div>
              <div className="flex h-3 space-x-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-full w-1 rounded-full bg-primary",
                      "animate-bounce",
                    )}
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text || "Digitando..."}</p>}
          </Wrapper>
        );

      case "working":
        return (
          <Wrapper>
            <div className="relative">
              <div className={cn("animate-spin text-primary", sizeMap[size].icon)}>
                <CircleDashed />
              </div>
              <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary", 
                sizeMap[size].icon.includes("h-4") ? "h-3 w-3" : "",
                sizeMap[size].icon.includes("h-6") ? "h-4 w-4" : "",
                sizeMap[size].icon.includes("h-8") ? "h-6 w-6" : "",
              )}>
                <Hammer className="animate-pulse" />
              </div>
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text || "Trabalhando..."}</p>}
          </Wrapper>
        );

      case "calculating":
        return (
          <Wrapper>
            <div className="flex flex-col items-center">
              <div className={cn("text-primary", sizeMap[size].icon)}>
                <Calculator className="animate-bounce" />
              </div>
              <div className="mt-2 h-1 w-16 overflow-hidden rounded-full bg-primary/20">
                <div className="h-full w-full animate-progress-indeterminate bg-primary" />
              </div>
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text || "Calculando..."}</p>}
          </Wrapper>
        );

      case "searching":
        return (
          <Wrapper>
            <div className="relative">
              <div className={cn("text-primary animate-pulse", sizeMap[size].icon)}>
                <FileSearch />
              </div>
              <div className="mt-2 flex space-x-1">
                {Array(3).fill(0).map((_, i) => (
                  <div 
                    key={i}
                    className="h-1 w-1 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text || "Buscando..."}</p>}
          </Wrapper>
        );

      case "coding":
        return (
          <Wrapper>
            <div className="relative">
              <div className={cn("text-primary", sizeMap[size].icon)}>
                <Monitor />
              </div>
              <div className="mt-1">
                <div className="flex space-x-1 overflow-hidden font-mono text-xs">
                  {Array(3).fill(0).map((_, i) => (
                    <div 
                      key={i}
                      className="animate-pulse text-primary"
                      style={{ animationDelay: `${i * 0.25}s` }}
                    >
                      &lt;/&gt;
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text || "Codificando..."}</p>}
          </Wrapper>
        );

      default:
        return (
          <Wrapper>
            <div className={cn("animate-spin text-primary", sizeMap[size].icon)}>
              <RefreshCcw />
            </div>
            {text && <p className={cn("text-muted-foreground", sizeMap[size].text)}>{text}</p>}
          </Wrapper>
        );
    }
  };

  return renderLoading();
}