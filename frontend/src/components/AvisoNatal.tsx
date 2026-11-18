import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "avisoFimAlbumVisto";
const FIM_ALBUM_IMAGE = "/images/fim_album.png";

export default function AvisoNatal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const jaViu = localStorage.getItem(STORAGE_KEY);

    if (!jaViu) {
      setOpen(true);
    }
  }, []);

  const fechar = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          fechar();
        }
      }}
    >
      <DialogContent className="max-w-3xl overflow-hidden border-0 bg-transparent p-0 shadow-2xl">
        <div className="overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-950">
          <img
            src={FIM_ALBUM_IMAGE}
            alt="Fim do album"
            className="block max-h-[82vh] w-full object-contain"
          />

          <DialogFooter className="border-t border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-950">
            <Button onClick={fechar} className="w-full sm:w-auto">
              Fechar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
