import { TestBed } from '@angular/core/testing';

import { ActionTrackerService } from './action-tracker.service';

describe('ActionTrackerService', () => {
  let service: ActionTrackerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActionTrackerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
