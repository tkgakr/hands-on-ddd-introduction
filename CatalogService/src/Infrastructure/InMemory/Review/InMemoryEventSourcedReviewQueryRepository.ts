import { injectable } from "tsyringe";

import { BookId } from "Domain/models/Book/BookId/BookId";
import { IReviewQueryRepository } from "Domain/models/Review/IReviewQueryRepository";
import { Review } from "Domain/models/Review/Review";
import { reconstructReviewDomainEvent } from "Domain/shared/DomainEvent/Review/ReviewDomainEventFactory";
import { InMemoryEventStoreRepository } from "Infrastructure/InMemory/EventStore/InMemoryEventStoreRepository";

@injectable()
export class InMemoryEventSourcedReviewQueryRepository implements IReviewQueryRepository {
  constructor(
    private eventStoreRepository: InMemoryEventStoreRepository,
  ) {}

  async findAllByBookId(bookId: BookId): Promise<Review[]> {
    const events = this.eventStoreRepository["events"];

    const reviewCreatedEvents = events.filter(
      (event) =>
        event.aggregateType === "Review" &&
        event.eventType === "ReviewCreated" &&
        event.eventBody["bookId"] === bookId.value,
    );

    const reviews = await Promise.all(
      reviewCreatedEvents.map((event) =>
        this.eventStoreRepository.find(event.aggregateId, "Review", (reviewEvents) =>
          Review.reconstruct(reviewEvents.map(reconstructReviewDomainEvent)),
        ),
      ),
    );

    return reviews.filter((review): review is Review => review !== null);
  }
}
