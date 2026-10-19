"use client";

import { CardContactActions, type CardContactActionsProps } from "./card-contact-actions";

export function EventCardContactActions(props: Omit<CardContactActionsProps, "world">) {
  return <CardContactActions {...props} world="events" />;
}
