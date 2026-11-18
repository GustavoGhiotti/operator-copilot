import { Moon, Sun } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { useTheme } from "@/context/ThemeContext";

const DarkModeToggle = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <Toggle
      aria-label="Toggle dark mode"
      pressed={isDarkMode}
      onPressedChange={toggleDarkMode}
      className="p-2 rounded-full"
    >
      {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Toggle>
  );
};

export default DarkModeToggle;