import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DowntimeReportComponent } from './downtime-report.component';

describe('DowntimeReportComponent', () => {
  let component: DowntimeReportComponent;
  let fixture: ComponentFixture<DowntimeReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DowntimeReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DowntimeReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
