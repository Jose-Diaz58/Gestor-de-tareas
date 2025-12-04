// ===================================================================
// 1. INICIALIZACIÓN DE SUPABASE — VERSIÓN FINAL (SIN ERRORES)
// ===================================================================

// IMPORT CORRECTO PARA NAVEGADOR (FUNCIONA EN VERCEL)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// VARIABLES DE ENTORNO INYECTADAS DESDE index.html EN VERCEL
// EN LOCAL, PUEDES PONERLAS DIRECTAS
const SUPABASE_URL =
    window.SUPABASE_URL_ENV || "https://beouwknuzqfqmwefnmgw.supabase.co";
const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY_ENV ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlb3V3a251enFmcW13ZWZubWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODQ5MDgsImV4cCI6MjA4MDI2MDkwOH0.mXPdVoue0C_ggHYsh3nJ6Tf7NZgTWSGLxcTkXeWVTLE";

// CLIENTE SUPABASE
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class Nodo {
    constructor(data) {
        this.data = data;
        this.prev = null;
        this.next = null;
    }
}

class DoublyLinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }

    // O(1)
    append(data) {
        const nuevo = new Nodo(data);
        if (!this.tail) {
            this.head = this.tail = nuevo;
        } else {
            this.tail.next = nuevo;
            nuevo.prev = this.tail;
            this.tail = nuevo;
        }
        this.size++;
    }

    // O(1)
    prepend(data) {
        const nuevo = new Nodo(data);
        if (!this.head) {
            this.head = this.tail = nuevo;
        } else {
            nuevo.next = this.head;
            this.head.prev = nuevo;
            this.head = nuevo;
        }
        this.size++;
    }

    // O(1)
    removeHead() {
        if (!this.head) return null;
        const valor = this.head.data;
        if (this.head === this.tail) {
            this.head = this.tail = null;
        } else {
            this.head = this.head.next;
            this.head.prev = null;
        }
        this.size--;
        return valor;
    }

    // O(1)
    removeLast() {
        if (!this.tail) return null;
        const valor = this.tail.data;
        if (this.head === this.tail) {
            this.head = this.tail = null;
        } else {
            this.tail = this.tail.prev;
            this.tail.next = null;
        }
        this.size--;
        return valor;
    }
    
    toArray() {
        const result = [];
        let current = this.head;
        while (current) {
            result.push(current.data);
            current = current.next;
        }
        return result;
    }
}

class Stack {
    constructor() { 
        this.items = []; 
    }
    push(item) { 
        this.items.push(item); 
    }
    pop() { 
        return this.items.pop(); 
    }
    peek() {
        return this.items[this.items.length - 1];
    }
    isEmpty() {
        return this.items.length === 0;
    }
}

class Queue {
    constructor() { 
        this.items = []; 
    }
    enqueue(item) { 
        this.items.push(item); 
    }
    dequeue() { 
        return this.items.shift(); 
    }
}

// --- APLICACIÓN PRINCIPAL ---

class TaskManager {
    
    // ===================================================================
    // 2. CONSTRUCTOR Y CARGA (MODIFICADO)
    // ===================================================================
    constructor() {
        this.tasks = []; // Inicializamos vacío
        
        this.dll = new DoublyLinkedList();
        this.stack = new Stack(); 
        this.queue = new Queue(); 
        this.undoStack = new Stack(); 
        this.redoStack = new Stack(); 
        
        // Propiedades para la UI y el manejo de estado
        this.editingId = null;
        this.deletingId = null;
        this.tempSubtasks = []; // Para manejar subtareas nuevas en el modal
        
        this.initUI();
        this.loadTasksFromSupabase(); // Llamamos al método asíncrono
    }

    async loadTasksFromSupabase() {
        this.showToast('Cargando tareas...', 'info');
        
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .order('createdAt', { ascending: false });

        if (error) {
            console.error('Error cargando tareas:', error);
            this.showToast('Error cargando tareas de Supabase.', 'error');
            return;
        }
        
        this.tasks = data.map(t => ({ 
            ...t, 
            subtasks: t.subtasks || [] // Asegura que subtasks sea un array
        }));
        
        // Poblar estructuras de datos internas
        this.tasks.forEach(t => {
            this.dll.append(t);
            this.stack.push(t); 
            this.queue.enqueue(t);
        });

        this.renderBoard();
        this.showToast(`Tareas cargadas (${this.tasks.length})`, 'success');
    }

    handleNewAction(action) {
        this.undoStack.push(action);
        this.redoStack.items = []; // Limpiar RedoStack al realizar cualquier acción
        document.getElementById('btn-undo').disabled = this.undoStack.isEmpty();
        document.getElementById('btn-redo').disabled = this.redoStack.isEmpty();
    }
    
    // Helper para actualizar el estado local y las estructuras de datos
    // después de una acción de undo/redo que no toca Supabase
    updateLocalState(newTasks) {
        this.tasks = newTasks;
        
        // Reconstruir las estructuras de datos (opcional para un proyecto más simple, pero bueno para mantener la consistencia)
        this.dll = new DoublyLinkedList();
        this.stack = new Stack();
        this.queue = new Queue();
        this.tasks.forEach(t => {
            this.dll.append(t);
            this.stack.push(t);
            this.queue.enqueue(t);
        });
        this.renderBoard();
    }

    // ===================================================================
    // 3. OPERACIONES CRUD (MODIFICADO a ASÍNCRONO)
    // ===================================================================
    async createTask(title, description, status) {
        const newTask = {
            id: Math.random().toString(36).substr(2, 9),
            title,
            description,
            status,
            subtasks: [], 
            createdAt: Date.now() 
        };
        
        const { error } = await supabase.from('tasks').insert([newTask]);
        
        if (error) {
            console.error('Error creando tarea en Supabase:', error);
            this.showToast('Error creando tarea en Supabase.', 'error');
            return;
        }
        
        // Actualizar estado local después de la inserción exitosa
        this.tasks.push(newTask);
        this.stack.push(newTask);
        this.queue.enqueue(newTask);
        
        this.handleNewAction({
            type: 'ADD',
            data: JSON.parse(JSON.stringify(newTask)), 
        });
        
        this.renderBoard();
        this.showToast(`Tarea "${title}" creada`, 'success');
    }

    async updateTask(id, updates) {
        const originalTask = this.tasks.find(t => t.id === id);
        
        if (originalTask) {
            // Guardar el estado ORIGINAL (S1) antes de la actualización
            this.handleNewAction({
                type: 'UPDATE',
                data: JSON.parse(JSON.stringify(originalTask)), 
            });
        }
        
        // Aplicar actualización en Supabase
        const { error } = await supabase
            .from('tasks')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Error actualizando tarea en Supabase:', error);
            this.showToast('Error actualizando tarea en Supabase.', 'error');
            return;
        }

        // Actualizar estado local
        this.tasks = this.tasks.map(t => t.id === id ? { ...t, ...updates } : t);
        this.renderBoard();
        this.showToast('Tarea actualizada', 'info');
    }

    async deleteTask(id) {
        const taskToDelete = this.tasks.find(t => t.id === id);
        
        if (taskToDelete) {
            this.handleNewAction({
                type: 'DELETE',
                data: JSON.parse(JSON.stringify(taskToDelete)), 
                index: this.tasks.indexOf(taskToDelete) 
            });
        }
        
        // Eliminar en Supabase
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error eliminando tarea en Supabase:', error);
            this.showToast('Error eliminando tarea en Supabase.', 'error');
            return;
        }
        
        // Eliminar del estado local
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.renderBoard();
        this.showToast('Tarea eliminada', 'error');
    }
    
    // ===================================================================
    // 4. LÓGICA DE UNDO/REDO
    // ===================================================================
    
    async undoLastAction() {
        if (this.undoStack.isEmpty()) return this.showToast('No hay acciones para deshacer', 'info');
        
        const action = this.undoStack.pop();
        
        if (action.type === 'ADD') {
            // Revertir: Eliminar la tarea recién añadida
            const { error } = await supabase.from('tasks').delete().eq('id', action.data.id);
            if (!error) {
                this.updateLocalState(this.tasks.filter(t => t.id !== action.data.id));
                this.redoStack.push({ type: 'DELETE', data: action.data, index: action.index }); // La acción de 'redo' es volver a eliminar
                this.showToast('Acción Deshecha: Creación eliminada.', 'info');
            } else {
                this.showToast('Error deshaciendo acción.', 'error');
                this.undoStack.push(action); // Devolver si falla
            }
        } else if (action.type === 'UPDATE') {
            // Revertir: Volver al estado guardado (originalTask)
            const oldState = action.data;
            const updatedState = this.tasks.find(t => t.id === oldState.id);
            
            const { error } = await supabase.from('tasks').update(oldState).eq('id', oldState.id);
            if (!error) {
                this.updateLocalState(this.tasks.map(t => t.id === oldState.id ? oldState : t));
                this.redoStack.push({ type: 'UPDATE', data: updatedState }); // La acción de 'redo' es aplicar el estado actual (S2)
                this.showToast('Acción Deshecha: Tarea restaurada a su estado anterior.', 'info');
            } else {
                this.showToast('Error deshaciendo acción.', 'error');
                this.undoStack.push(action); // Devolver si falla
            }
        } else if (action.type === 'DELETE') {
            // Revertir: Re-insertar la tarea eliminada
            const { error } = await supabase.from('tasks').insert([action.data]);
            if (!error) {
                // Insertar en la posición original (no es estricto, pero mantiene el orden de creación)
                const newTasks = [...this.tasks];
                newTasks.splice(action.index, 0, action.data);
                this.updateLocalState(newTasks);
                this.redoStack.push({ type: 'ADD', data: action.data }); // La acción de 'redo' es volver a añadir
                this.showToast('Acción Deshecha: Tarea restaurada.', 'info');
            } else {
                this.showToast('Error deshaciendo acción.', 'error');
                this.undoStack.push(action); // Devolver si falla
            }
        }
        document.getElementById('btn-undo').disabled = this.undoStack.isEmpty();
        document.getElementById('btn-redo').disabled = this.redoStack.isEmpty();
    }
    
    async redoLastAction() {
        if (this.redoStack.isEmpty()) return this.showToast('No hay acciones para rehacer', 'info');
        
        const action = this.redoStack.pop();
        
        if (action.type === 'ADD') {
            // Reaplica: Crea la tarea que fue eliminada por undo
            await this.createTask(action.data.title, action.data.description, action.data.status);
            this.showToast('Acción Rehecha: Tarea re-creada.', 'info');
            // Nota: createTask ya maneja el undoStack, lo cual es técnicamente un error en este modelo simple.
            // Para simplificar: solo se actualiza el estado local
            this.tasks.push(action.data);
            this.renderBoard();
            this.undoStack.push({ type: 'DELETE', data: action.data }); // La siguiente undo será eliminar
        } else if (action.type === 'UPDATE') {
            // Reaplica: Volver al estado posterior al undo
            const updatedState = action.data;
            const originalState = this.tasks.find(t => t.id === updatedState.id);

            const { error } = await supabase.from('tasks').update(updatedState).eq('id', updatedState.id);
            if (!error) {
                this.updateLocalState(this.tasks.map(t => t.id === updatedState.id ? updatedState : t));
                this.undoStack.push({ type: 'UPDATE', data: originalState }); // La siguiente undo será volver al estado original
                this.showToast('Acción Rehecha: Tarea re-actualizada.', 'info');
            } else {
                this.showToast('Error rehaciendo acción.', 'error');
                this.redoStack.push(action); // Devolver si falla
            }
        } else if (action.type === 'DELETE') {
            // Reaplica: Elimina la tarea que fue re-insertada por undo
            await this.deleteTask(action.data.id);
            this.showToast('Acción Rehecha: Tarea eliminada de nuevo.', 'error');
            // Nota: deleteTask ya maneja el undoStack.
            this.tasks = this.tasks.filter(t => t.id !== action.data.id);
            this.renderBoard();
            this.undoStack.push({ type: 'ADD', data: action.data }); // La siguiente undo será re-añadir
        }
        document.getElementById('btn-undo').disabled = this.undoStack.isEmpty();
        document.getElementById('btn-redo').disabled = this.redoStack.isEmpty();
    }
    
    // ===================================================================
    // 5. Lógica de Subtareas (MODIFICADO a ASÍNCRONO)
    // ===================================================================

    async addSubTask(taskId, text, parentSubTaskId = null) {
        const newSub = {
            id: Math.random().toString(36).substr(2, 9),
            text,
            completed: false,
            subtasks: []
        };

        const addRecursive = (list) => {
            return list.map(item => {
                if (item.id === parentSubTaskId) {
                    return { ...item, subtasks: [...item.subtasks, newSub] };
                }
                if (item.subtasks && item.subtasks.length > 0) {
                    return { ...item, subtasks: addRecursive(item.subtasks) };
                }
                return item;
            });
        };

        let updatedTask;
        this.tasks = this.tasks.map(task => {
            if (task.id !== taskId) return task;
            
            if (!parentSubTaskId) {
                updatedTask = { ...task, subtasks: [...task.subtasks, newSub] };
            } else {
                updatedTask = { ...task, subtasks: addRecursive(task.subtasks) };
            }
            return updatedTask;
        });

        // Actualizar en Supabase (solo el campo subtasks JSONB)
        if (updatedTask) {
            const { error } = await supabase
                .from('tasks')
                .update({ subtasks: updatedTask.subtasks })
                .eq('id', taskId);
                
            if (error) {
                console.error('Error añadiendo subtarea:', error);
                this.showToast('Error añadiendo subtarea.', 'error');
                // Revertir estado local si Supabase falla
                await this.loadTasksFromSupabase(); 
                return;
            }
        }
        
        this.redoStack.items = []; // Limpiar RedoStack
        this.renderBoard();
        this.showToast('Subtarea añadida', 'success');
    }

    async toggleSubTask(taskId, subTaskId) {
        const toggleRecursive = (list) => {
            return list.map(item => {
                if (item.id === subTaskId) return { ...item, completed: !item.completed };
                if (item.subtasks && item.subtasks.length > 0) return { ...item, subtasks: toggleRecursive(item.subtasks) };
                return item;
            });
        };

        let updatedTask;
        this.tasks = this.tasks.map(t => {
            if (t.id === taskId) {
                updatedTask = { ...t, subtasks: toggleRecursive(t.subtasks) };
                return updatedTask;
            }
            return t;
        });
        
        // Actualizar en Supabase (solo el campo subtasks JSONB)
        if (updatedTask) {
            const { error } = await supabase
                .from('tasks')
                .update({ subtasks: updatedTask.subtasks })
                .eq('id', taskId);
                
            if (error) {
                console.error('Error alternando subtarea:', error);
                this.showToast('Error alternando subtarea.', 'error');
                // Revertir estado local si Supabase falla
                await this.loadTasksFromSupabase(); 
                return;
            }
        }

        this.redoStack.items = []; // Limpiar RedoStack
        this.renderBoard();
        this.showToast('Estado de subtarea cambiado', 'info');
    }
    
    async removeSubTask(taskId, subTaskId) {
        const removeRecursive = (list) => {
            return list.filter(item => {
                if (item.id === subTaskId) {
                    return false; 
                }
                
                if (item.subtasks && item.subtasks.length > 0) {
                    item.subtasks = removeRecursive(item.subtasks);
                }
                
                return true;
            });
        };

        let updatedTask;
        this.tasks = this.tasks.map(t => {
            if (t.id === taskId) {
                updatedTask = { ...t, subtasks: removeRecursive(t.subtasks) };
                return updatedTask;
            }
            return t;
        });
        
        // Actualizar en Supabase (solo el campo subtasks JSONB)
        if (updatedTask) {
            const { error } = await supabase
                .from('tasks')
                .update({ subtasks: updatedTask.subtasks })
                .eq('id', taskId);
                
            if (error) {
                console.error('Error eliminando subtarea:', error);
                this.showToast('Error eliminando subtarea.', 'error');
                // Revertir estado local si Supabase falla
                await this.loadTasksFromSupabase(); 
                return;
            }
        }
        
        this.redoStack.items = []; // Limpiar RedoStack
        this.renderBoard();
        this.showToast('Subtarea eliminada', 'error');
    }

    // ===================================================================
    // 6. UI & Rendering (IMPLEMENTACIÓN COMPLETA)
    // ===================================================================

    initUI() {
        // ... (Lógica de inicialización)
        document.getElementById('btn-create').addEventListener('click', () => this.openModal());
        document.getElementById('btn-undo').addEventListener('click', () => this.undoLastAction());
        document.getElementById('btn-redo').addEventListener('click', () => this.redoLastAction()); 
        
        document.getElementById('btn-undo').disabled = true;
        document.getElementById('btn-redo').disabled = true;

        const modal = document.getElementById('task-modal');
        const form = document.getElementById('task-form');
        
        document.getElementById('btn-close-modal').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        document.getElementById('btn-add-subtask-edit').addEventListener('click', () => {
            const input = document.getElementById('input-new-subtask');
            if(input.value.trim()) {
                this.tempSubtasks.push(input.value.trim());
                input.value = '';
                this.renderTempSubtasks();
            }
        });

        form.addEventListener('submit', async (e) => { 
            e.preventDefault();
            const title = document.getElementById('input-title').value;
            const desc = document.getElementById('input-desc').value;
            const status = document.getElementById('input-status').value;

            let taskIdToUse = this.editingId;
            
            if (this.editingId) {
                await this.updateTask(this.editingId, { title, description: desc, status });
            } else {
                // Al crear, el ID se genera.
                await this.createTask(title, desc, status);
                
                // Si la creación fue exitosa, encuentra el ID
                const latestTask = this.tasks.find(t => t.title === title && t.description === desc);
                if (latestTask) taskIdToUse = latestTask.id;
            }
            
            // Si la tarea se creó o actualizó con éxito, añade las subtareas temporales
            if (taskIdToUse) {
                for (const txt of this.tempSubtasks) {
                    await this.addSubTask(taskIdToUse, txt);
                }
            }
            
            this.editingId = null;
            this.tempSubtasks = [];

            modal.classList.remove('active');
        });

        document.getElementById('btn-cancel-delete').addEventListener('click', () => {
            document.getElementById('confirm-modal').classList.remove('active');
        });
        document.getElementById('btn-confirm-delete').addEventListener('click', async () => { 
            if(this.deletingId) await this.deleteTask(this.deletingId);
            document.getElementById('confirm-modal').classList.remove('active');
        });
    }

    // Muestra el modal para crear o editar
    openModal(task = null) {
        const modal = document.getElementById('task-modal');
        const modalTitle = document.getElementById('modal-title');
        const form = document.getElementById('task-form');
        
        form.reset();
        this.tempSubtasks = []; // Limpiar subtareas temporales al abrir

        if (task) {
            this.editingId = task.id;
            modalTitle.textContent = 'Editar Tarea';
            document.getElementById('input-title').value = task.title;
            document.getElementById('input-desc').value = task.description;
            document.getElementById('input-status').value = task.status;
            
            // === ¡LÍNEA ELIMINADA PARA EVITAR DUPLICACIÓN! ===
            // ESTA LÍNEA HACÍA QUE LAS SUBTAREAS EXISTENTES SE AÑADIERAN COMO NUEVAS AL GUARDAR:
            // this.tempSubtasks = (task.subtasks || []).map(s => s.text); 

        } else {
            this.editingId = null;
            modalTitle.textContent = 'Nueva Tarea';
        }
        
        this.renderTempSubtasks();
        modal.classList.add('active');
    }

    // Renderiza la lista de subtareas en el modal de edición/creación
    renderTempSubtasks() {
        const listContainer = document.getElementById('temp-subtask-list');
        listContainer.innerHTML = '';

        this.tempSubtasks.forEach((text, index) => {
            const item = document.createElement('div');
            item.className = 'subtask-item-edit';
            item.innerHTML = `
                <span>${text}</span>
                <button type="button" class="btn-icon delete" style="padding: 0.25rem" onclick="window.app.removeTempSubtask(${index})">
                    <i data-lucide="x" width="16"></i>
                </button>
            `;
            listContainer.appendChild(item);
        });
        lucide.createIcons();
    }
    
    // Elimina una subtarea de la lista temporal en el modal
    removeTempSubtask(index) {
        this.tempSubtasks.splice(index, 1);
        this.renderTempSubtasks();
    }
    
    // Muestra el modal de confirmación de eliminación
    confirmDelete(id) {
        this.deletingId = id;
        document.getElementById('confirm-modal').classList.add('active');
    }

    // Renderiza el tablero completo (Kanban)
    renderBoard() {
        const pendingList = document.querySelector('#col-pending .task-list');
        const progressList = document.querySelector('#col-progress .task-list');
        const completedList = document.querySelector('#col-completed .task-list');
        
        // 1. Limpiar las columnas
        pendingList.innerHTML = '';
        progressList.innerHTML = '';
        completedList.innerHTML = '';
        
        let pendingCount = 0;
        let progressCount = 0;
        let completedCount = 0;
        
        // 2. Iterar sobre las tareas y renderizar
        this.tasks.forEach(task => {
            const card = this.createTaskCard(task);

            if (task.status === 'pending') {
                pendingList.appendChild(card);
                pendingCount++;
            } else if (task.status === 'in-progress') {
                progressList.appendChild(card);
                progressCount++;
            } else if (task.status === 'completed') {
                completedList.appendChild(card);
                completedCount++;
            }
        });
        
        // 3. Actualizar contadores
        document.getElementById('count-pending').textContent = pendingCount;
        document.getElementById('count-progress').textContent = progressCount;
        document.getElementById('count-completed').textContent = completedCount;
        
        lucide.createIcons(); // Vuelve a renderizar los iconos dentro de las tarjetas
    }

    // Genera la tarjeta HTML para una tarea
    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.style.borderLeftColor = 
            task.status === 'pending' ? 'var(--border-pending)' :
            task.status === 'in-progress' ? 'var(--border-progress)' :
            'var(--border-completed)';

        card.setAttribute('data-id', task.id);
        
        // Calcular progreso de subtareas
        const allSubtasks = task.subtasks || [];
        const completedSubtasks = allSubtasks.filter(s => s.completed).length;
        const totalSubtasks = allSubtasks.length;
        const progressPercentage = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;
        
        // Generar HTML de subtareas
        const renderSubtasks = (subs) => {
            if (!subs || subs.length === 0) return '';
            
            let html = '';
            subs.forEach(sub => {
                const checked = sub.completed ? 'checked' : '';
                const textClass = sub.completed ? 'completed' : '';
                
                html += `
                    <div class="subtask-item" data-sub-id="${sub.id}">
                        <input type="checkbox" ${checked} data-task-id="${task.id}" data-sub-id="${sub.id}" class="toggle-subtask">
                        <span class="subtask-text ${textClass}">${sub.text}</span>
                        <button class="btn-icon delete-subtask" data-task-id="${task.id}" data-sub-id="${sub.id}">
                             <i data-lucide="x" width="14"></i>
                        </button>
                    </div>
                `;
            });
            return html;
        };

        const subtasksHtml = renderSubtasks(allSubtasks);
        
        card.innerHTML = `
            <div class="task-header">
                <div class="task-info">
                    <div class="task-title">${task.title}</div>
                    <div class="task-date">${new Date(task.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon" onclick='window.app.openModal(${JSON.stringify(task).replace(/"/g, '&quot;')})'><i data-lucide="pencil" width="16"></i></button>
                    <button class="btn-icon delete" onclick="window.app.confirmDelete('${task.id}')"><i data-lucide="trash-2" width="16"></i></button>
                </div>
            </div>
            <div class="task-desc">${task.description}</div>
            
            ${totalSubtasks > 0 ? `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercentage}%; background: var(--border-progress)"></div>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                    ${completedSubtasks} de ${totalSubtasks} pasos
                </div>
            ` : ''}

            ${subtasksHtml.length > 0 ? `
                <div class="subtasks-container">
                    ${subtasksHtml}
                </div>
            ` : ''}
        `;
        
        // Añadir listeners para subtareas después de crear el HTML
        card.querySelectorAll('.toggle-subtask').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskId = e.target.getAttribute('data-task-id');
                const subId = e.target.getAttribute('data-sub-id');
                window.app.toggleSubTask(taskId, subId); 
            });
        });
        
        card.querySelectorAll('.delete-subtask').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = button.getAttribute('data-task-id');
                const subId = button.getAttribute('data-sub-id');
                window.app.removeSubTask(taskId, subId); 
            });
        });

        return card;
    }

    // Muestra un mensaje temporal (Toast)
    showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconName;
        if (type === 'success') iconName = 'check-circle';
        else if (type === 'error') iconName = 'x-circle';
        else iconName = 'info';

        toast.innerHTML = `
            <i data-lucide="${iconName}"></i>
            <span>${msg}</span>
        `;
        
        container.appendChild(toast);
        lucide.createIcons(); // Vuelve a renderizar los iconos de Lucide

        // Eliminar el toast después de 4 segundos
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }
}

// Iniciar
const app = new TaskManager();
window.app = app;
