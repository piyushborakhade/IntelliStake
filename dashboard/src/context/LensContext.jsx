import { createContext, useContext, useState } from 'react';

export const LensContext = createContext({ lens: 'investor', setLens: () => {} });

export const useLens = () => useContext(LensContext);

export function LensProvider({ children }) {
  const [lens, setLens] = useState(
    () => localStorage.getItem('intellistake_lens') || 'investor'
  );

  const setLensAndSave = (l) => {
    localStorage.setItem('intellistake_lens', l);
    setLens(l);
  };

  return (
    <LensContext.Provider value={{ lens, setLens: setLensAndSave }}>
      {children}
    </LensContext.Provider>
  );
}
