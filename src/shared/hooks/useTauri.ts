import { useEffect, useState } from "react";
import { isTauri } from "../../core/utils/platform";

export function useIsTauri() {
  const [tauri, setTauri] = useState(false);
  useEffect(() => {
    setTauri(isTauri());
  }, []);
  return tauri;
}
