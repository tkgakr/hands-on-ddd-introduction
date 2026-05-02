import { DomainEvent } from "./DomainEvent/DomainEvent";

export abstract class Aggregate<Event extends DomainEvent> {
  domainEvents: Event[] = [];
  private _version = 0;

  protected addDomainEvent(domainEvent: Event) {
    domainEvent.assignVersion(this._version + 1);
    this.domainEvents.push(domainEvent);
    this._version = domainEvent.version;
  }

  getDomainEvents(): Event[] {
    return this.domainEvents;
  }

  protected restoreVersionFromHistory(domainEvents: Event[]) {
    this._version = domainEvents[domainEvents.length - 1]?.version ?? 0;
  }

  get version(): number {
    return this._version;
  }

  clearDomainEvents() {
    this.domainEvents = [];
  }
}
