import {addRelative, editPerson} from './family-model.mjs';
import {firebaseConfig, adminEmail} from './firebase-config.mjs';
const tree = window.familyTree;
const login = document.querySelector('#admin-login'), status = document.querySelector('#admin-status');
login.disabled=true;
let signingIn = false;
let auth, db, api, user, admin = false, ready = false, cloudExists = false, busy = false;
const dialog = document.createElement('dialog'); dialog.className='editor'; dialog.setAttribute('aria-labelledby','editor-title');
dialog.innerHTML=`<form><h2 id="editor-title">Agregar familiar</h2><p id="editor-context"></p><label id="relation-label">Vínculo<select name="relation"><option value="child">Hijo / hija</option><option value="sibling">Hermano / hermana</option><option value="partner">Pareja</option><option value="father">Padre</option><option value="mother">Madre</option></select></label><div id="relationship-options"></div><label>Nombre completo<input name="name" required maxlength="200" autocomplete="off"></label><div class="fields"><label>Fecha de nacimiento<input name="birthDate" maxlength="120" placeholder="Ej. 13 FEB 1900 o aprox. 1900"></label><label>Lugar de nacimiento<input name="birthPlace" maxlength="200"></label><label>Fecha de matrimonio<input name="marriageDate" maxlength="120"></label><label>Lugar de matrimonio<input name="marriagePlace" maxlength="200"></label><label>Fecha de fallecimiento<input name="deathDate" maxlength="120"></label><label>Lugar de fallecimiento<input name="deathPlace" maxlength="200"></label></div><p class="help">Deja vacíos los datos que todavía no conoces. Las fechas pueden ser aproximadas.</p><p class="editor-error" role="alert"></p><div class="editor-actions"><button type="button" id="editor-cancel">Cancelar</button><button type="submit">Guardar</button></div></form>`;
document.body.append(dialog);
const form=dialog.querySelector('form'), relation=form.elements.relation, options=dialog.querySelector('#relationship-options'), error=dialog.querySelector('.editor-error');
let anchorId, editing=false, expectedPerson;
function message(text){status.textContent=text;}
function decorate(){
 document.querySelectorAll('.card-tools').forEach(n=>n.remove());
 if(!admin || !ready || !cloudExists)return;
 for(const node of document.querySelectorAll('.node[data-id]')){
   const controls=document.createElement('div'); controls.className='card-tools';
   for(const [symbol,label,edit] of [['+','Agregar familiar',false],['✎','Editar datos',true]]){
     const b=document.createElement('button'); b.type='button'; b.textContent=symbol; b.title=label; b.setAttribute('aria-label',`${label}: ${tree.people()[node.dataset.id].name}`); b.onclick=()=>open(node.dataset.id,edit); controls.append(b);
   }
   node.parentElement.append(controls);
 }
}
document.addEventListener('family-render',decorate);
function relationshipOptions(){
 options.replaceChildren(); if(editing)return;
 const p=tree.people()[anchorId];
 const help=document.createElement('p'); help.className='help';
 if(relation.value==='child'){
  const label=document.createElement('label'); label.textContent='Otro progenitor (opcional)';
  const select=document.createElement('select'); select.name='coParent'; select.add(new Option('Solo vincular conmigo / persona seleccionada',''));
  p.partners.forEach(id=>select.add(new Option(tree.people()[id].name,id))); label.append(select); options.append(label);
  help.textContent='Solo se vinculará con la pareja que elijas.';
 }else if(relation.value==='sibling'){
  help.textContent=p.parents.length?'Selecciona los progenitores que comparten. Puedes dejar todos sin marcar si aún no lo sabes.':'Se registrará el vínculo de hermanos sin inventar progenitores.';
  p.parents.forEach(id=>{const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.name='sharedParents';input.value=id;label.append(input,document.createTextNode(tree.people()[id].name));options.append(label);});
 }else if(['father','mother'].includes(relation.value)){
  help.textContent='Se agregará una persona nueva. Revisa los progenitores existentes para no duplicarlos: '+(p.parents.map(id=>tree.people()[id].name).join(', ')||'ninguno registrado')+'. No se crearán otros vínculos automáticamente.';
 }else help.textContent='Se agregará una pareja nueva sin asignarle automáticamente los hijos existentes.';
 options.append(help);
}
function open(id,edit){
 if(!admin || !ready || !cloudExists)return;
 anchorId=id;editing=edit;form.reset();error.textContent='';
 const p=tree.people()[id];expectedPerson=JSON.stringify(p);
 dialog.querySelector('h2').textContent=edit?'Editar datos':'Agregar familiar';dialog.querySelector('#editor-context').textContent=p.name;
 dialog.querySelector('#relation-label').hidden=edit;
 if(edit){form.elements.name.value=p.name;for(const key of ['birth','death','marriage']){form.elements[key+'Date'].value=p[key]?.date||'';form.elements[key+'Place'].value=p[key]?.plac||'';}}
 relationshipOptions();dialog.showModal();form.elements.name.focus();
}
relation.onchange=relationshipOptions;
dialog.querySelector('#editor-cancel').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
form.onsubmit=async event=>{
 event.preventDefault();if(busy||!admin||!ready)return;
 busy=true;error.textContent='';form.querySelectorAll('button').forEach(b=>b.disabled=true);
 const fields={name:form.elements.name.value.trim()};for(const key of ['birth','death','marriage'])fields[key]={date:form.elements[key+'Date'].value.trim(),plac:form.elements[key+'Place'].value.trim()};
 const newId='@I_'+crypto.randomUUID()+'@', kind=relation.value;
 const opts={id:newId,coParent:form.elements.coParent?.value||'',sharedParents:[...options.querySelectorAll('input:checked')].map(n=>n.value)};
 try{
  const savedPeople=await api.runTransaction(db,async transaction=>{
    const ref=api.doc(db,'trees','family'),snapshot=await transaction.get(ref);
    if(!snapshot.exists())throw new Error('Primero debes activar el árbol en la nube.');
    const current=snapshot.data();
    if(editing && JSON.stringify(current.people[anchorId])!==expectedPerson)throw new Error('Los datos cambiaron en otra ventana. Cierra y vuelve a abrir el formulario.');
    const people=editing?editPerson(current.people,anchorId,fields):addRelative(current.people,anchorId,kind,fields,opts);
    transaction.set(ref,{people,revision:current.revision+1,updatedAt:api.serverTimestamp(),updatedBy:auth.currentUser.uid});
    return people;
  });
  tree.replace(savedPeople);tree.select(editing?anchorId:newId);
  dialog.close();message('Guardado en Firebase.');
 }catch(e){error.textContent=e.code?'No se pudo guardar. Comprueba la conexión y los permisos; tus datos siguen en el formulario.':e.message;}
 finally{busy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
};
async function activate(){
 if(!admin||!ready)return;
 login.disabled=true;
 try{
 const initial=structuredClone(tree.people());
 await api.runTransaction(db,async transaction=>{
  const ref=api.doc(db,'trees','family'),snapshot=await transaction.get(ref);
  if(snapshot.exists())return;
  transaction.set(ref,{people:initial,revision:1,updatedAt:api.serverTimestamp(),updatedBy:auth.currentUser.uid});
 });message('Árbol activado. Ya puedes agregar familiares desde cada tarjeta.');
 }catch(e){message('No se pudo activar el árbol. Comprueba las reglas de Firebase y la conexión.');}finally{login.disabled=false;}
}
function authUI(){
 login.textContent=user?(admin&&!cloudExists?'Activar árbol en Firebase':'Cerrar sesión'):'Administrar';
 if(admin)message(cloudExists?'Modo administrador · cambios guardados en Firebase':'Para empezar, activa en Firebase una copia del árbol actual.');
 else if(user)message('Tu cuenta tiene acceso de lectura.');
 else message(cloudExists?'Árbol sincronizado':'');
 decorate();
}
login.onclick=async()=>{
 if(signingIn)return;
 if(!auth){message('La conexión con Firebase no está disponible. Recarga para volver a intentar.');return;}
 try{if(admin&&!cloudExists){await activate();return;}if(user)await api.signOut(auth);else {signingIn=true;login.disabled=true;message('Abriendo Google…');await api.signInWithPopup(auth,new api.GoogleAuthProvider());}}
 catch(e){console.warn('Inicio de sesión Firebase:',e.code);message(e.code==='auth/popup-closed-by-user'?'Inicio de sesión cancelado.':'No se pudo iniciar sesión. Abre el sitio en Chrome o Safari y permite la ventana de Google.');}
 finally{signingIn=false;login.disabled=false;}
};
async function start(){
 try{
 const [appModule,authModule,firestoreModule]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);
 api={...authModule,...firestoreModule};const app=appModule.initializeApp(firebaseConfig);auth=api.getAuth(app);db=api.getFirestore(app);login.disabled=false;
 api.onAuthStateChanged(auth,current=>{user=current;admin=!!current&&current.email===adminEmail&&current.emailVerified&&current.providerData.some(p=>p.providerId==='google.com');if(!admin&&dialog.open)dialog.close();authUI();});
 api.onSnapshot(api.doc(db,'trees','family'),{includeMetadataChanges:true},snapshot=>{
   ready=!snapshot.metadata.fromCache;cloudExists=snapshot.exists();
   if(cloudExists){const data=snapshot.data();if(!data.people||!Object.keys(data.people).length){ready=false;message('La copia de Firebase no es válida. Se conserva la vista actual.');decorate();return;}tree.replace(data.people);}
   authUI();
 },()=>{ready=false;decorate();message('Sin conexión a la base de datos. Edición deshabilitada; se conserva la vista actual.');});
 }catch(e){login.disabled=false;message('Firebase no está disponible. Puedes seguir consultando el árbol.');}
}
start();
