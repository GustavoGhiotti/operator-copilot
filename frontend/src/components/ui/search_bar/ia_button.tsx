import { Bot } from "lucide-react";
import { useState } from "react";

const [infoCommand, setInfoCommand] = useState<string | null>(null);
const showInfo = (command: string) => {
    setInfoCommand(command);
};

function IA()
{
    return(
        <div
            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-200 hover:shadow-md"
            onClick={() => selectCommand("@IA")}
            >
            <div className="flex items-start gap-2">
                <Bot className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-foreground truncate">
                    @IA
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                    Aurora IA
                </div>
                </div>
                <button
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                    e.stopPropagation();
                    showInfo("@IA");
                }}
                >
                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                </button>
            </div>
        </div>
    )
}

export default IA;