# Lo que sigue en LABURO

**Reescrito el 8/9/2026.** La versión anterior de este archivo listaba dos
agujeros y tres cosas chicas. **Están las cinco hechas, aplicadas en producción y
probadas corriéndolas.** Lo que queda acá abajo es lo que no se puede cerrar
solo escribiendo código.

---

# Lo que se hizo hoy, y dónde mirarlo

| Qué | Dónde | Migración |
|---|---|---|
| El proveedor y el salón pueden elegir contraseña | `app/registrar-proveedor`, `app/registrar-salon`, el mail de bienvenida | — |
| La cotización se parte en ítems | `LICITACIONES.md` etapa 6 | `0087` |
| Un pedido se corrige sin rehacerlo | `/cotizaciones/[id]/editar` | `0088` |
| El brief con dos trabajos avisa que son dos pedidos | `app/api/pedido-desde-brief` | — |
| La pantalla vacía dice si los pedidos están en la otra productora | `app/(portal)/cotizaciones` | — |
| El mail de invitación lista los ítems, y el reenvío también | `components/emails/invitacion-cotizar-email.tsx` | `0089` |

---

# 1. LA DECISIÓN QUE HAY QUE TOMAR: ¿se adjudica por ítem?

Es lo único de la etapa 6 que quedó abierto **a propósito**, y no se puede
resolver en una sesión de trabajo porque no es una pregunta técnica.

**Hoy se adjudica la cotización ENTERA**, como siempre: un ganador y varios que
no, cada uno con su mail. La matriz de comparación ya muestra lo otro: cuánto
daría **tomando el más barato de cada renglón**, y entre cuántos proveedores
quedaría repartido.

**El modelo lo aguanta** (la ganadora pasaría a ser por línea y no por
cotización). Lo que cambia es todo lo de afuera:

- Los mails. Hoy hay un ganador. Con adjudicación por ítem hay que escribirle a
  alguien "ganaste la cena pero no los coffees", que es un mail que no existe.
- Quién coordina. Dos proveedores en el mismo evento es una decisión de
  producción, no de planilla.

**La recomendación sigue siendo la misma: no construirlo hasta ver si se usa.**
La pantalla ya te dice cuánto estarías dejando arriba de la mesa; si Franco
mira ese número tres veces y no reparte nunca, la respuesta está.

---

# 2. Correrlo con un caso real

Es lo mismo que dice `LICITACIONES.md` desde el 5/9 y sigue siendo lo más
importante: **nunca salió una invitación a una empresa de verdad.**

Todo se probó contra producción (transacciones con rollback, datos de juguete
borrados al terminar, las pantallas renderizadas con el servidor levantado), y
los mails se revisaron renderizados. Pero el copy de la invitación, que es de
donde salen o no salen los precios, **solo lo puede probar un pedido real**.

El primer pedido real es además la única forma de saber si la cotización por
ítems se entiende sin explicarla.

---

# 3. Lo que queda anotado, sin diseño todavía

- ✅ **¿Qué pasa si nadie cotiza?** (28/10, `e432038`) La lista dice «Venció
  sin presupuestos» o «Falta elegir», y el detalle explica y ofrece correr el
  cierre o cancelar. Sigue sin mandar ningún aviso por mail: eso no está decidido.
- ✅ **Duplicar un pedido.** (28/10, `fec7fe4`) «Hacer otro pedido igual», en el
  detalle de cualquier pedido, abre `/cotizaciones/nuevo?desde=<id>` con todo
  cargado menos invitados, presupuestos y fecha de cierre.
- **Un pedido sin cuenta.** Hoy el pedido cuelga de una organización.
  `provider_contacts` dejó preparado el `organization_id` nullable para abrirlo
  a un independiente, pero es la Fase 4 y no está decidida.

---

# 4. Y lo que no es de este módulo, pero es lo que más pesa

LABURO está terminado y **casi sin usar**. Nada de lo de arriba mueve esa aguja:
son mejoras a un producto que todavía no tiene volumen de uso real. Antes de
seguir sumando funciones conviene mirar por qué no se usa, que es una
conversación de producto y no una sesión de código.
