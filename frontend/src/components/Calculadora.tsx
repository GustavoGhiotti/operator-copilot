import { useRef, useState } from "react";
import { X } from "lucide-react";

type CalculadoraProps = {
  onClose?: () => void;
};

const Calculadora = ({ onClose }: CalculadoraProps) => {
  const [display, setDisplay] = useState("0");
  const [firstValue, setFirstValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingNextValue, setWaitingNextValue] = useState(false);

  const [position, setPosition] = useState({
    x: typeof window !== "undefined" ? window.innerWidth - 360 : 100,
    y: 100,
  });

  const [isDragging, setIsDragging] = useState(false);

  const dragOffset = useRef({
    x: 0,
    y: 0,
  });

  function inputNumber(value: string) {
    if (waitingNextValue) {
      setDisplay(value);
      setWaitingNextValue(false);
      return;
    }

    setDisplay((currentDisplay) => {
      if (currentDisplay === "0") {
        return value;
      }

      return currentDisplay + value;
    });
  }

  function inputDecimal() {
    if (waitingNextValue) {
      setDisplay("0.");
      setWaitingNextValue(false);
      return;
    }

    if (!display.includes(".")) {
      setDisplay((currentDisplay) => currentDisplay + ".");
    }
  }

  function clearCalculator() {
    setDisplay("0");
    setFirstValue(null);
    setOperator(null);
    setWaitingNextValue(false);
  }

  function toggleSignal() {
    setDisplay((currentDisplay) => {
      if (currentDisplay === "0") {
        return currentDisplay;
      }

      return String(Number(currentDisplay) * -1);
    });
  }

  function percentage() {
    setDisplay((currentDisplay) => {
      return String(Number(currentDisplay) / 100);
    });
  }

  function handleOperator(nextOperator: string) {
    const currentValue = Number(display);

    if (firstValue === null) {
      setFirstValue(currentValue);
      setOperator(nextOperator);
      setWaitingNextValue(true);
      return;
    }

    if (operator) {
      const result = calculate(firstValue, currentValue, operator);

      setDisplay(formatResult(result));
      setFirstValue(result);
      setOperator(nextOperator);
      setWaitingNextValue(true);
    }
  }

  function handleEquals() {
    if (firstValue === null || operator === null) {
      return;
    }

    const currentValue = Number(display);
    const result = calculate(firstValue, currentValue, operator);

    setDisplay(formatResult(result));
    setFirstValue(null);
    setOperator(null);
    setWaitingNextValue(true);
  }

  function calculate(valueA: number, valueB: number, currentOperator: string) {
    switch (currentOperator) {
      case "+":
        return valueA + valueB;
      case "-":
        return valueA - valueB;
      case "*":
        return valueA * valueB;
      case "/":
        if (valueB === 0) {
          return NaN;
        }

        return valueA / valueB;
      default:
        return valueB;
    }
  }

  function formatResult(value: number) {
    if (Number.isNaN(value)) {
      return "Erro";
    }

    if (!Number.isFinite(value)) {
      return "Erro";
    }

    return String(Number(value.toFixed(10)));
  }

  function handleDragStart(event: React.MouseEvent<HTMLDivElement>) {
    setIsDragging(true);

    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  }

  function handleDragging(event: React.MouseEvent<HTMLDivElement>) {
    if (!isDragging) {
      return;
    }

    setPosition({
      x: event.clientX - dragOffset.current.x,
      y: event.clientY - dragOffset.current.y,
    });
  }

  function handleDragEnd() {
    setIsDragging(false);
  }

  const buttons = [
    { label: "C", action: clearCalculator, variant: "muted" },
    { label: "+/-", action: toggleSignal, variant: "muted" },
    { label: "%", action: percentage, variant: "muted" },
    { label: "÷", action: () => handleOperator("/"), variant: "operator" },

    { label: "7", action: () => inputNumber("7"), variant: "number" },
    { label: "8", action: () => inputNumber("8"), variant: "number" },
    { label: "9", action: () => inputNumber("9"), variant: "number" },
    { label: "×", action: () => handleOperator("*"), variant: "operator" },

    { label: "4", action: () => inputNumber("4"), variant: "number" },
    { label: "5", action: () => inputNumber("5"), variant: "number" },
    { label: "6", action: () => inputNumber("6"), variant: "number" },
    { label: "-", action: () => handleOperator("-"), variant: "operator" },

    { label: "1", action: () => inputNumber("1"), variant: "number" },
    { label: "2", action: () => inputNumber("2"), variant: "number" },
    { label: "3", action: () => inputNumber("3"), variant: "number" },
    { label: "+", action: () => handleOperator("+"), variant: "operator" },

    { label: "0", action: () => inputNumber("0"), variant: "number", wide: true },
    { label: ".", action: inputDecimal, variant: "number" },
    { label: "=", action: handleEquals, variant: "equals" },
  ];

  return (
    <div
      onMouseMove={handleDragging}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      className="fixed inset-0 z-[99] pointer-events-none"
    >
      <div
        className="
          pointer-events-auto w-[320px] overflow-hidden rounded-2xl
          border border-zinc-200 bg-white shadow-xl
          dark:border-zinc-800 dark:bg-zinc-950
        "
        style={{
          position: "absolute",
          left: position.x,
          top: position.y,
        }}
      >
        <div
          onMouseDown={handleDragStart}
          className="
            flex cursor-move items-center justify-between border-b border-zinc-200
            bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900
          "
        >
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Calculadora
          </span>

          <button
            type="button"
            onClick={onClose}
            className="
              rounded-lg p-1 text-zinc-500 transition
              hover:bg-zinc-200 hover:text-zinc-900
              dark:hover:bg-zinc-800 dark:hover:text-zinc-100
            "
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <div
            className="
              mb-4 flex min-h-20 items-end justify-end overflow-hidden
              rounded-xl bg-zinc-100 px-4 py-3
              text-right text-4xl font-semibold text-zinc-900
              dark:bg-zinc-900 dark:text-zinc-100
            "
          >
            <span className="break-all">{display}</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {buttons.map((button) => (
              <button
                key={button.label}
                type="button"
                onClick={button.action}
                className={[
                  "h-14 rounded-xl text-lg font-semibold transition active:scale-95",
                  button.wide ? "col-span-2" : "",
                  button.variant === "number"
                    ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    : "",
                  button.variant === "muted"
                    ? "bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    : "",
                  button.variant === "operator"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "",
                  button.variant === "equals"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "",
                ].join(" ")}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calculadora;