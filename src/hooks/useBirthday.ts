import { useState, useEffect, useCallback } from "react";
import { BIRTHDAYS } from "../utils/constants";

interface BirthdayState {
  isBirthday: boolean;
  name: string | null;
}

function checkBirthday(): BirthdayState {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  for (const b of BIRTHDAYS) {
    if (b.month === month && b.day === day) {
      return { isBirthday: true, name: b.name };
    }
  }
  return { isBirthday: false, name: null };
}

export function useBirthday(): BirthdayState {
  const [state, setState] = useState<BirthdayState>(checkBirthday);

  const recheck = useCallback(() => {
    setState(checkBirthday());
  }, []);

  useEffect(() => {
    // Recheck at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timer = setTimeout(() => {
      recheck();
      // Then check every 24h
      const interval = setInterval(recheck, 24 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, [recheck]);

  return state;
}
