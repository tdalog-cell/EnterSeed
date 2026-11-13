import { expect, test } from 'vitest';
import { profileSchema, recommend, calculateCosting, compareQuotes, daySchema, manilaDay, reminderState } from './guidance';
const profile = profileSchema.parse({businessName:'Test',sector:'Food',stage:'operating',size:'micro',location:'Tupi',products:'Bread',goal:'profit',challenges:'',language:'en'});
test('recommendations are deterministic, distinct and respond to goal and stage',()=>{
  expect(recommend(profile).map(a=>a.tool)).toEqual(['costing','quotations','marketing']);
  expect(recommend({...profile,goal:'cash'}).map(a=>a.tool)).toEqual(['finance','calendar','costing']);
  expect(recommend({...profile,stage:'idea'})[2].tool).toBe('documents');
  expect(new Set(recommend(profile).map(a=>a.key)).size).toBe(3);
});
const cost = {name:'Bread',materials:100,labor:0,packaging:0,transport:0,other:0,fixedFees:0,feePercent:10,units:10,target:20,mode:'margin' as const};
test('margin and markup correctly include percentage fees and batch costs',()=>{
  const margin=calculateCosting(cost),markup=calculateCosting({...cost,mode:'markup'});
  expect(margin.price).toBeCloseTo(14.285714);
  expect(margin.margin).toBeCloseTo(20);
  expect(markup.price).toBeCloseTo(13.333333);
  expect(markup.profit).toBeCloseTo(2);
  expect(calculateCosting({...cost,materials:0}).margin).toBe(0);
  expect(()=>calculateCosting({...cost,units:0})).toThrow();
  expect(()=>calculateCosting({...cost,target:90})).toThrow();
  expect(()=>calculateCosting({...cost,materials:NaN})).toThrow();
});
test('quotes compare minimum-order quantities and landed cost without ranking suppliers',()=>{
  const quote={supplier:'A',product:'Bag',price:5,minimum:100,delivery:100,charges:0,leadDays:3,terms:'Cash'};
  const rows=compareQuotes({name:'Bags',quantity:50,quotes:[quote,{...quote,supplier:'B',minimum:10,price:7,delivery:0}]});
  expect(rows[0]).toMatchObject({quantity:100,total:600,landedUnitCost:6,excess:50});
  expect(rows[1]).toMatchObject({quantity:50,total:350,landedUnitCost:7,excess:0});
});
test('Manila calendar dates handle midnight, leap days and completed status',()=>{
  expect(manilaDay(new Date('2026-11-13T16:00:00Z'))).toBe('2026-11-14');
  expect(daySchema.safeParse('2026-02-29').success).toBe(false);
  expect(daySchema.safeParse('2028-02-29').success).toBe(true);
  expect(reminderState({date:'2026-11-12',completed:false},'2026-11-13')).toBe('overdue');
  expect(reminderState({date:'2026-11-12',completed:true},'2026-11-13')).toBe('completed');
});
