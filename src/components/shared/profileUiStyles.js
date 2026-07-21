import { cn } from '../../ui/utils';

export const PROFILE_TABS_LIST_CLASS = [
    'mb-6 inline-flex h-auto w-max max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 text-slate-600 scrollbar-hide'
].join(' ');

export const PROFILE_TAB_TRIGGER_CLASS = [
    'h-9 flex-none whitespace-nowrap rounded-md px-3 text-xs font-semibold',
    'data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm',
    'sm:px-5 sm:text-sm'
].join(' ');

export const PROFILE_LABEL_CLASS = 'flex items-center gap-2 text-sm font-semibold text-slate-500';

export const PROFILE_INPUT_CLASS = [
    'h-11 rounded-lg border-slate-200 bg-white text-base font-semibold text-slate-950',
    'placeholder:text-slate-400',
    'disabled:cursor-default disabled:border-slate-200 disabled:bg-white disabled:text-slate-950 disabled:opacity-100',
    'md:text-sm'
].join(' ');

export const PROFILE_DISPLAY_VALUE_CLASS = [
    'flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-3 py-2',
    'text-[15px] font-semibold text-slate-950'
].join(' ');

export function profileInputClass(...classes) {
    return cn(PROFILE_INPUT_CLASS, ...classes);
}

export function profileLabelClass(...classes) {
    return cn(PROFILE_LABEL_CLASS, ...classes);
}
