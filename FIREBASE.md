# Árbol Familiar: edición con Firebase

Proyecto: `arbol-familiar-3d628` (plan Spark). Firestore Standard en Santiago (`southamerica-west1`). Google Authentication habilitado; dominio de producción autorizado: `britown.github.io`.

## Primer uso

1. Abrir https://britown.github.io/arbol-site/ en Chrome o Safari.
2. Pulsar **Administrar** e iniciar sesión con **hbrito@gmail.com**.
3. Pulsar **Activar árbol en Firebase**. Se copian las 192 personas actuales una única vez, mediante una transacción que no sobreescribe un árbol existente.
4. Cada tarjeta muestra **+** para agregar un familiar y **✎** para editar datos. Elegir el parentesco, completar el nombre y guardar. La nueva tarjeta queda seleccionada y sus vínculos se muestran en el árbol.

La lectura sigue siendo pública. Las reglas del servidor exigen una sesión Google con correo verificado `hbrito@gmail.com` para escribir; ocultar botones no es el control de seguridad. Otras cuentas solo pueden leer. No hay borrado de personas desde la app.

## Datos y relaciones

Firestore guarda `trees/family`, con el mapa `people`, una revisión creciente y auditoría básica del último cambio. Las transacciones evitan perder altas concurrentes; una edición avisa si la misma persona cambió desde que se abrió el formulario. Se conservan propiedades originales no editadas.

Agregar un hijo permite elegir otro progenitor entre las parejas existentes. Agregar un hermano permite elegir progenitores compartidos, o registrar solo el vínculo entre hermanos. No se infieren parejas ni padres desconocidos. Los roles padre/madre nuevos son explícitos y no reinterpretan los vínculos antiguos.

El HTML conserva la copia original como respaldo de lectura si Firebase no carga. Tras activar Firebase, la nube es la fuente vigente: cambiar el JSON del HTML no actualiza los datos remotos. El documento único está limitado por Firestore a 1 MiB; para árboles mucho mayores habrá que migrar a una colección de personas.

`firebase-config.mjs` contiene configuración web pública, nunca credenciales de servicio. Las reglas están en `firestore.rules`. `firestore.indexes.json` define la exención de índices del mapa `people`, recomendable al crecer el árbol. Con Firebase CLI autenticado se despliega con:

```sh
firebase deploy --only firestore --project arbol-familiar-3d628
```

## Verificación

```sh
node --test tests/family-model.test.mjs
node --check admin.mjs
```

Se probó la interfaz con un adaptador en memoria aislado (no incluido en el sitio), alta de hijo con dos progenitores y hermano con un progenitor compartido. La escritura REST sin autenticación fue rechazada (403). La primera autenticación Google y activación real requieren completarse en un navegador que permita la ventana de Google.
