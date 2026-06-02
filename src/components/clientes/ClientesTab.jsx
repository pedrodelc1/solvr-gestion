import { useState } from 'react';
import { ClientesList } from './ClientesList.jsx';
import { ClienteDetail } from './ClienteDetail.jsx';
import { ClienteForm } from './ClienteForm.jsx';
import { ConfirmModal } from '../shared/Modal.jsx';
import { PedidoForm } from '../pedidos/PedidoForm.jsx';

export function ClientesTab({
  clientes, pedidos,
  onSaveCliente, onDeleteCliente,
  onSavePedido, onUpdatePedido, onDeletePedido,
  productos, onSaveProducto, toast,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'nuevoPedido'
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cliente = clientes.find(c => c.id === selectedId) || null;

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit() {
    setEditing(cliente);
    setFormOpen(true);
  }

  async function handleSave(data) {
    await onSaveCliente(data);
    setFormOpen(false);
  }

  async function handleDelete() {
    await onDeleteCliente(selectedId);
    setSelectedId(null);
    setConfirmDelete(false);
    setView('list');
  }

  function handleSelectCliente(id) {
    setSelectedId(id);
    setView('detail');
  }

  function handleBackToList() {
    setSelectedId(null);
    setView('list');
  }

  if (view === 'nuevoPedido' && selectedId) {
    return (
      <PedidoForm
        clientes={clientes}
        productos={productos}
        preClienteId={selectedId}
        onSave={async (data) => {
          await onSavePedido(data);
          setView('detail');
        }}
        onBack={() => setView('detail')}
        onProductoCreated={onSaveProducto}
        toast={toast}
      />
    );
  }

  return (
    <>
      {view === 'list' ? (
        <ClientesList
          clientes={clientes}
          pedidos={pedidos}
          onSelect={handleSelectCliente}
          onNew={handleNew}
        />
      ) : (
        <ClienteDetail
          cliente={cliente}
          pedidos={pedidos}
          onBack={handleBackToList}
          onEdit={handleEdit}
          onDelete={() => setConfirmDelete(true)}
          onNuevoPedido={() => setView('nuevoPedido')}
        />
      )}

      <ClienteForm
        open={formOpen}
        existing={editing}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmModal
        open={confirmDelete}
        title="Eliminar cliente"
        message={`¿Eliminar a ${cliente?.nombre}? Se perderán todos sus datos.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
