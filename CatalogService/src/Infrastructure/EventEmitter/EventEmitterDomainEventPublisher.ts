import { IDomainEventPublisher } from "Application/shared/DomainEvent/IDomainEventPublisher";
import { DomainEvent } from "Domain/shared/DomainEvent/DomainEvent";

import { eventEmitterClient } from "./EventEmitterClient";

export class EventEmitterDomainEventPublisher implements IDomainEventPublisher {
  publish(domainEvent: DomainEvent): void {
    eventEmitterClient.emit("CatalogService", domainEvent);
  }
}
