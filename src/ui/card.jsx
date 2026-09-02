import * as React from "react";

import { cn } from "./utils";
import ServicePetPeek from "../components/shared/ServicePetPeek.jsx";

const PET_KINDS = ["dog", "cat", "bunny", "parrot"];
const PET_ACCENTS = ["blue", "coral", "sun", "mint"];
const PET_EXCLUDED_ANCESTORS = [
  '[data-slot="dialog-content"]',
  '[data-slot="sheet-content"]',
  '[data-slot="dashboard-navigation"]',
  'nav',
  '[role="dialog"]',
].join(',');
const PET_DENSE_CONTENT = [
  'form',
  'table',
  '[data-slot="table"]',
  'canvas',
  'video',
  'iframe',
  'img',
  'picture',
  '[contenteditable="true"]',
  '[data-slot="card"] [data-slot="card"]',
].join(',');

function petVariant(seed) {
  const hash = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);

  return {
    kind: PET_KINDS[hash % PET_KINDS.length],
    accent: PET_ACCENTS[Math.floor(hash / PET_KINDS.length) % PET_ACCENTS.length],
  };
}

function cardCanShowPet(element, force = false) {
  if (!element || element.closest(PET_EXCLUDED_ANCESTORS)) return false;
  if (force) return true;

  const bounds = element.getBoundingClientRect();
  const textLength = String(element.innerText || '').replace(/\s+/g, ' ').trim().length;
  const interactiveCount = element.querySelectorAll('button, a, input, select, textarea, [role="button"]').length;

  return bounds.width >= 280
    && bounds.height >= 140
    && bounds.height <= 320
    && textLength <= 240
    && interactiveCount <= 2
    && !element.querySelector(PET_DENSE_CONTENT);
}

function Card({ className, children, petHover = true, petKind, petAccent, petPosition = "bottom-right", ...props }) {
  const cardRef = React.useRef(null);
  const petSeed = React.useId();
  const [isPetEligible, setIsPetEligible] = React.useState(false);
  const automaticVariant = React.useMemo(() => petVariant(petSeed), [petSeed]);

  React.useEffect(() => {
    const card = cardRef.current;
    if (!card || !petHover) {
      setIsPetEligible(false);
      return undefined;
    }

    let animationFrame = null;
    const updateEligibility = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      animationFrame = window.requestAnimationFrame(() => {
        const nextEligibility = cardCanShowPet(card, petHover === 'always');
        setIsPetEligible((current) => current === nextEligibility ? current : nextEligibility);
      });
    };

    updateEligibility();
    const resizeObserver = new ResizeObserver(updateEligibility);
    resizeObserver.observe(card);

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      resizeObserver.disconnect();
    };
  }, [children, petHover]);

  return (
    <div
      ref={cardRef}
      data-slot="card"
      data-pet-hover={isPetEligible ? "eligible" : "disabled"}
      data-pet-position={petPosition}
      className={cn(
        "app-pet-hover-card relative isolate flex min-w-0 flex-col gap-4 rounded-xl border border-slate-200/90 bg-white text-slate-950 shadow-sm shadow-slate-950/[0.04] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:shadow-black/10",
        className,
      )}
      {...props}
    >
      {isPetEligible ? (
        <ServicePetPeek
          kind={petKind || automaticVariant.kind}
          accent={petAccent || automaticVariant.accent}
        />
      ) : null}
      {children}
    </div>
  );
}

function CardHeader({ className, ...props }) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid min-w-0 auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-4 pt-4 sm:px-5 sm:pt-5 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto] [.border-b]:pb-4",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }) {
  return (
    <h4
      data-slot="card-title"
      className={cn("min-w-0 text-base font-bold leading-tight text-slate-950", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }) {
  return (
    <p
      data-slot="card-description"
      className={cn("min-w-0 text-sm leading-5 text-slate-500", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 flex min-w-0 justify-self-end self-start",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }) {
  return (
    <div
      data-slot="card-content"
      className={cn("min-w-0 px-4 sm:px-5 [&:last-child]:pb-4 sm:[&:last-child]:pb-5", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex min-w-0 flex-wrap items-center gap-2 px-4 pb-4 sm:px-5 sm:pb-5 [.border-t]:pt-4", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
