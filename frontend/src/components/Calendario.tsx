import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

type CalendarioProps = {
  onClose?: () => void;
};

type HolidayType = "feriado" | "ponto_facultativo";

type Holiday = {
  date: string;
  name: string;
  type: HolidayType;
  blockPayment: boolean;
};

type CalendarDay = {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  holiday?: Holiday;
};

const Calendario = ({ onClose }: CalendarioProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);

  const [position, setPosition] = useState({
    x: typeof window !== "undefined" ? window.innerWidth - 420 : 100,
    y: 100,
  });

  const [isDragging, setIsDragging] = useState(false);

  const dragOffset = useRef({
    x: 0,
    y: 0,
  });

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const currentYear = currentDate.getFullYear();

  const holidays = useMemo(() => {
    return getBrazilianNationalHolidays(currentYear);
  }, [currentYear]);

  const monthName = currentDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDay = firstDayOfMonth.getDay();
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: CalendarDay[] = [];

    const previousMonthLastDay = new Date(year, month, 0).getDate();

    for (let i = startDay - 1; i >= 0; i--) {
      const day = previousMonthLastDay - i;
      const date = new Date(year, month - 1, day);

      days.push({
        date,
        day,
        isCurrentMonth: false,
        isToday: isSameDate(date, new Date()),
        holiday: findHolidayByDate(date, holidays),
      });
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const date = new Date(year, month, day);

      days.push({
        date,
        day,
        isCurrentMonth: true,
        isToday: isSameDate(date, new Date()),
        holiday: findHolidayByDate(date, holidays),
      });
    }

    const remainingDays = 42 - days.length;

    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);

      days.push({
        date,
        day,
        isCurrentMonth: false,
        isToday: isSameDate(date, new Date()),
        holiday: findHolidayByDate(date, holidays),
      });
    }

    return days;
  }, [currentDate, holidays]);

  function goToPreviousMonth() {
    setCurrentDate((date) => {
      return new Date(date.getFullYear(), date.getMonth() - 1, 1);
    });

    setSelectedHoliday(null);
  }

  function goToNextMonth() {
    setCurrentDate((date) => {
      return new Date(date.getFullYear(), date.getMonth() + 1, 1);
    });

    setSelectedHoliday(null);
  }

  function goToToday() {
    const today = new Date();
    const holiday = findHolidayByDate(today, holidays);

    setCurrentDate(today);
    setSelectedDate(today);
    setSelectedHoliday(holiday ?? null);
  }

  function handleSelectDate(calendarDay: CalendarDay) {
    setSelectedDate(calendarDay.date);
    setSelectedHoliday(calendarDay.holiday ?? null);

    if (calendarDay.holiday?.blockPayment) {
      return;
    }

    console.log("Data válida para pagamento:", formatDateToISO(calendarDay.date));
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
            Calendário de Pagamentos
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
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="
                rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium
                text-zinc-700 transition hover:bg-zinc-100
                dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800
              "
            >
              Anterior
            </button>

            <div className="text-center">
              <h2 className="text-lg font-semibold capitalize text-zinc-900 dark:text-zinc-100">
                {monthName}
              </h2>

              <button
                type="button"
                onClick={goToToday}
                className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Hoje
              </button>
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              className="
                rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium
                text-zinc-700 transition hover:bg-zinc-100
                dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800
              "
            >
              Próximo
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {weekDays.map((weekDay) => (
              <div
                key={weekDay}
                className="py-2 text-xs font-semibold uppercase text-zinc-500"
              >
                {weekDay}
              </div>
            ))}

            {calendarDays.map((calendarDay) => {
              const isSelected =
                selectedDate !== null &&
                isSameDate(calendarDay.date, selectedDate);

              const isBlocked = Boolean(calendarDay.holiday?.blockPayment);

              return (
                <button
                  key={calendarDay.date.toISOString()}
                  type="button"
                  onClick={() => handleSelectDate(calendarDay)}
                  title={calendarDay.holiday?.name}
                  className={[
                    "relative flex aspect-square items-center justify-center rounded-xl text-sm font-medium transition",
                    calendarDay.isCurrentMonth
                      ? "text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      : "text-zinc-300 hover:bg-zinc-50 dark:text-zinc-700 dark:hover:bg-zinc-900",
                    calendarDay.isToday
                      ? "border border-blue-500 text-blue-600"
                      : "",
                    isSelected && !isBlocked
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "",
                    isBlocked
                      ? "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                      : "",
                  ].join(" ")}
                >
                  {calendarDay.day}

                  {calendarDay.holiday && (
                    <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3">
            {selectedDate && (
              <div className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                Data selecionada:{" "}
                <strong>
                  {selectedDate.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
              </div>
            )}

            {selectedHoliday && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                <strong>Pagamento não recomendado nesta data.</strong>

                <p className="mt-1">
                  {selectedHoliday.name} —{" "}
                  {selectedHoliday.type === "feriado"
                    ? "feriado nacional"
                    : "ponto facultativo"}.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="h-3 w-3 rounded-full bg-red-100 ring-1 ring-red-300 dark:bg-red-950 dark:ring-red-900" />
              Datas marcadas indicam feriado ou ponto facultativo com bloqueio
              para pagamento.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function getBrazilianNationalHolidays(year: number): Holiday[] {
  const easter = getEasterDate(year);

  const carnivalMonday = addDays(easter, -48);
  const carnivalTuesday = addDays(easter, -47);
  const ashWednesday = addDays(easter, -46);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  return [
    {
      date: `${year}-01-01`,
      name: "Confraternização Universal",
      type: "feriado",
      blockPayment: true,
    },
    {
      date: formatDateToISO(carnivalMonday),
      name: "Carnaval",
      type: "ponto_facultativo",
      blockPayment: true,
    },
    {
      date: formatDateToISO(carnivalTuesday),
      name: "Carnaval",
      type: "ponto_facultativo",
      blockPayment: true,
    },
    {
      date: formatDateToISO(ashWednesday),
      name: "Quarta-feira de Cinzas",
      type: "ponto_facultativo",
      blockPayment: true,
    },
    {
      date: formatDateToISO(goodFriday),
      name: "Paixão de Cristo",
      type: "feriado",
      blockPayment: true,
    },
    {
      date: `${year}-04-21`,
      name: "Tiradentes",
      type: "feriado",
      blockPayment: true,
    },
    {
      date: `${year}-05-01`,
      name: "Dia Mundial do Trabalho",
      type: "feriado",
      blockPayment: true,
    },
    {
      date: formatDateToISO(corpusChristi),
      name: "Corpus Christi",
      type: "ponto_facultativo",
      blockPayment: true,
    },
    {
      date: `${year}-09-07`,
      name: "Independência do Brasil",
      type: "feriado",
      blockPayment: true,
    },
    {
      date: `${year}-10-12`,
      name: "Nossa Senhora Aparecida",
      type: "feriado",
      blockPayment: true,
    },
    {
      date: `${year}-11-02`,
      name: "Finados",
      type: "feriado",
      blockPayment: true,
    },
    {
      date: `${year}-11-15`,
      name: "Proclamação da República",
      type: "feriado",
      blockPayment: true,
    },
    {
      date: `${year}-11-20`,
      name: "Dia Nacional de Zumbi e da Consciência Negra",
      type: "feriado",
      blockPayment: true,
    },
    {
      date: `${year}-12-25`,
      name: "Natal",
      type: "feriado",
      blockPayment: true,
    },
  ];
}

function getEasterDate(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);

  return newDate;
}

function findHolidayByDate(date: Date, holidays: Holiday[]) {
  const formattedDate = formatDateToISO(date);

  return holidays.find((holiday) => holiday.date === formattedDate);
}

function formatDateToISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isSameDate(dateA: Date, dateB: Date) {
  return (
    dateA.getDate() === dateB.getDate() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getFullYear() === dateB.getFullYear()
  );
}

export default Calendario;