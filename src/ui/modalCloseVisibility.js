import * as React from 'react';

const DISMISS_CANCEL_LABEL = 'cancel';

function normalizeLabel(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getTextContent(node) {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join(' ');
  }

  if (!React.isValidElement(node)) {
    return '';
  }

  return getTextContent(node.props?.children);
}

function getElementTypeName(type) {
  if (typeof type === 'string') {
    return type;
  }

  return type?.displayName || type?.name || '';
}

function isActionElement(element) {
  const typeName = getElementTypeName(element.type);

  return (
    typeName === 'button'
    || typeName === 'Button'
    || typeName === 'DialogClose'
    || typeName === 'SheetClose'
  );
}

function isCancelAction(element) {
  if (!React.isValidElement(element) || !isActionElement(element)) {
    return false;
  }

  const label = normalizeLabel(element.props?.['aria-label'] || getTextContent(element.props?.children));

  return label === DISMISS_CANCEL_LABEL;
}

export function hasCancelDismissAction(children) {
  let found = false;

  function visit(node) {
    if (found || node === null || node === undefined || typeof node === 'boolean') {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!React.isValidElement(node)) {
      return;
    }

    if (isCancelAction(node)) {
      found = true;
      return;
    }

    React.Children.forEach(node.props?.children, visit);
  }

  React.Children.forEach(children, visit);

  return found;
}
