import React, { useLayoutEffect, useRef, useState } from 'react';

type MemberInsightsRowProps = {
  activity: React.ReactNode;
  tasksChart: React.ReactNode;
};

/**
 * Aligne la hauteur de « Activité récente » sur celle de « Tasks per Project ».
 */
const MemberInsightsRow: React.FC<MemberInsightsRowProps> = ({ activity, tasksChart }) => {
  const tasksWrapRef = useRef<HTMLDivElement>(null);
  const [syncHeight, setSyncHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const wrap = tasksWrapRef.current;
    if (!wrap) return;

    const measure = () => {
      const panel = wrap.firstElementChild as HTMLElement | null;
      const h = Math.ceil(panel?.getBoundingClientRect().height ?? wrap.getBoundingClientRect().height);
      if (h > 0) setSyncHeight(h);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    const panel = wrap.firstElementChild;
    if (panel) ro.observe(panel);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [tasksChart]);

  return (
    <div className="cu-member-insights-row">
      <div
        className="cu-member-insights-row__activity"
        style={syncHeight ? { height: syncHeight } : undefined}
      >
        {activity}
      </div>
      <div ref={tasksWrapRef} className="cu-member-insights-row__tasks">
        {tasksChart}
      </div>
    </div>
  );
};

export default MemberInsightsRow;
