import test from 'node:test';
import assert from 'node:assert/strict';
import {addRelative,editPerson} from '../family-model.mjs';
const p = id => ({id,name:id,birth:{},death:{},parents:[],children:[],partners:[],siblings:[]});
test('child links selected parents and half siblings without changing source',()=>{
  const data={a:p('a'),b:p('b'),c:p('c')}; data.a.partners=['b']; data.a.children=['c']; data.c.parents=['a'];
  const next=addRelative(data,'a','child',{name:'Nuevo'},{id:'n',coParent:'b'});
  assert.deepEqual(next.n.parents,['a','b']); assert.deepEqual(next.b.children,['n']); assert.deepEqual(next.c.siblings,['n']); assert.deepEqual(next.n.siblings,['c']); assert.equal(data.n,undefined);
});
test('sibling shares only chosen parent',()=>{
  const data={a:p('a'),b:p('b'),c:p('c')}; data.a.parents=['b','c']; data.b.children=['a']; data.c.children=['a'];
  const next=addRelative(data,'a','sibling',{name:'Hermana'},{id:'n',sharedParents:['b']});
  assert.deepEqual(next.n.parents,['b']); assert.deepEqual(next.c.children,['a']); assert.deepEqual(next.a.siblings,['n']);
});
test('parent role explicit, no inferred spouse or other children',()=>{
 const data={a:p('a')}; const next=addRelative(data,'a','mother',{name:'Madre'},{id:'n'});
 assert.equal(next.a.parentRoles.mother,'n'); assert.deepEqual(next.n.children,['a']); assert.deepEqual(next.n.partners,[]);
 assert.throws(()=>addRelative(next,'a','mother',{name:'Otra'},{id:'x'}));
});
test('partner reciprocal and invalid operations fail',()=>{
 const data={a:p('a')}; const next=addRelative(data,'a','partner',{name:'Pareja'},{id:'n'});
 assert.deepEqual(next.n.partners,['a']); assert.deepEqual(next.a.partners,['n']);
 assert.throws(()=>addRelative(data,'a','child',{name:'Hijo'},{id:'n',coParent:'missing'}));
 assert.throws(()=>addRelative(data,'a','partner',{name:' '},{id:'n'}));
});
test('editing preserves relationships and unknown original data',()=>{
 const data={a:{...p('a'),sources:['original'],birth:{date:'1900',note:'aproximado'}}};
 const next=editPerson(data,'a',{name:'Nuevo',birth:{date:'1901',plac:''},death:{},marriage:{}});
 assert.deepEqual(next.a.sources,['original']); assert.equal(next.a.birth.note,'aproximado'); assert.equal(data.a.birth.date,'1900');
});
