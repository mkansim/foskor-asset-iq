import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReliabilityKpiDashboardComponent } from './reliability-kpi-dashboard.component';

describe('ReliabilityKpiDashboardComponent', () => {
  let component: ReliabilityKpiDashboardComponent;
  let fixture: ComponentFixture<ReliabilityKpiDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReliabilityKpiDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReliabilityKpiDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
