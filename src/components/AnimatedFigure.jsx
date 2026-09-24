import { useEffect, useRef, useState } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

export default function AnimatedFigure({ value, formatter = (v) => v, className = '' }) {
  const numericValue = Number(value) || 0;
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20 });
  const [display, setDisplay] = useState(formatter(0));
  const first = useRef(true);

  useEffect(() => {
    const unsubscribe = spring.on('change', (v) => setDisplay(formatter(Math.round(v))));
    return unsubscribe;
  }, [formatter]);

  useEffect(() => {
    if (first.current) {
      motionValue.jump(numericValue);
      setDisplay(formatter(numericValue));
      first.current = false;
    } else {
      motionValue.set(numericValue);
    }
  }, [numericValue]);

  return <span className={className}>{display}</span>;
}
