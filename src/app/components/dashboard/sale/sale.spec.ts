import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SalesService } from '../../../core/services/sales.service';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { Sales } from './sale';

describe('Sales', () => {
  let component: Sales;
  let fixture: ComponentFixture<Sales>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sales]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Sales);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
