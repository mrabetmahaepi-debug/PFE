import React, {

  createContext,

  useCallback,

  useContext,

  useEffect,

  useMemo,

  useState,

  type ReactNode,

} from 'react';



type MemberTopbarTitleContextValue = {

  title: string | null;

  setTitle: (title: string | null) => void;

};



const MemberTopbarTitleContext =

  createContext<MemberTopbarTitleContextValue | null>(null);



export function MemberTopbarTitleProvider({

  children,

}: {

  children: ReactNode;

}) {

  const [title, setTitleState] = useState<string | null>(null);

  const setTitle = useCallback((next: string | null) => {

    setTitleState(next);

  }, []);



  const value = useMemo(

    () => ({ title, setTitle }),

    [title, setTitle]

  );



  return (

    <MemberTopbarTitleContext.Provider value={value}>

      {children}

    </MemberTopbarTitleContext.Provider>

  );

}



export function useMemberTopbarTitle(): MemberTopbarTitleContextValue {

  const ctx = useContext(MemberTopbarTitleContext);

  if (!ctx) {

    return {

      title: null,

      setTitle: () => {},

    };

  }

  return ctx;

}



/** Set navbar title while mounted (Member workspace / list / project pages). */

export function useSetMemberTopbarTitle(title: string | null | undefined): void {

  const { setTitle } = useMemberTopbarTitle();

  useEffect(() => {

    const next = title?.trim() ? title.trim() : null;

    setTitle(next);

    return () => setTitle(null);

  }, [title, setTitle]);

}


