type NotifyProps = {
  title: string;
  description?: string;
  playSound?: boolean;
};

export async function notifyBrowser({
  title,
  description = "",
  playSound = true,
}: NotifyProps) {
  if (!("Notification" in window)) {
    return;
  }

  const showNotification = () => {
    new Notification(title, {
      body: description,
      silent: !playSound,
    });
  };

  if (Notification.permission === "granted") {
    showNotification();
    return;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      showNotification();
    }
  }
}