import { useState, useCallback, Dispatch, SetStateAction } from 'react';

export const useToggle = (initialValue: boolean = false): [boolean, () => void, Dispatch<SetStateAction<boolean>>] => {
  const [value, setValue] = useState<boolean>(initialValue);
  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);
  return [value, toggle, setValue];
};

export default useToggle;


