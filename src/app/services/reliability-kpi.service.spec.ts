import { TestBed } from '@angular/core/testing';

import { ReliabilityKpiService } from './reliability-kpi.service';

describe('ReliabilityKpiService', () => {
  let service: ReliabilityKpiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReliabilityKpiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
