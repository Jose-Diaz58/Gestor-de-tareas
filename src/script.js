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

// const STORAGE_KEY = 'kanban-vanilla-v1'; // ELIMINADO

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

    // save() { // ELIMINADO - Ya no se usa localStorage
    //     // ...
    // }

    handleNewAction(action) {
        this.undoStack.push(action);
        this.redoStack.items = []; // Limpiar RedoStack al realizar cualquier acción
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
            createdAt: Date.now() // Usamos Date.now(), compatible con 'numeric' en Supabase
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
        
        // this.save(); // ELIMINADO
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
        // this.save(); // ELIMINADO
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
        // this.save(); // ELIMINADO
        this.renderBoard();
        this.showToast('Tarea eliminada', 'error');
    }
    
    // ===================================================================
    // 4. LÓGICA DE UNDO/REDO (REQUIERE QUE LOS MÉTODOS DE ABAJO SEAN ASYNC)
    // ===================================================================
    
    // Nota: undo/redo no interactúa directamente con Supabase, 
    // solo revierte/reaplica cambios en el estado local.
    // La persistencia final se da al llamar a los métodos de CRUD.

    undoLastAction() {
        // ... (Lógica de undo sin cambios)
    }
    
    redoLastAction() {
        // ... (Lógica de redo sin cambios)
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
                if (item.subtasks.length > 0) {
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
                return;
            }
        }
        
        this.redoStack.items = []; // Limpiar RedoStack
        // this.save(); // ELIMINADO
        this.renderBoard();
        this.showToast('Subtarea añadida', 'success');
    }

    async toggleSubTask(taskId, subTaskId) {
        const toggleRecursive = (list) => {
            return list.map(item => {
                if (item.id === subTaskId) return { ...item, completed: !item.completed };
                if (item.subtasks.length > 0) return { ...item, subtasks: toggleRecursive(item.subtasks) };
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
                return;
            }
        }

        this.redoStack.items = []; // Limpiar RedoStack
        // this.save(); // ELIMINADO
        this.renderBoard();
        this.showToast('Estado de subtarea cambiado', 'info');
    }
    
    async removeSubTask(taskId, subTaskId) {
        const removeRecursive = (list) => {
            return list.filter(item => {
                if (item.id === subTaskId) {
                    return false; 
                }
                
                if (item.subtasks.length > 0) {
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
                return;
            }
        }
        
        this.redoStack.items = []; // Limpiar RedoStack
        // this.save(); // ELIMINADO
        this.renderBoard();
        this.showToast('Subtarea eliminada', 'error');
    }

    // --- UI & Rendering (NO MODIFICADO) ---

    initUI() {
        document.getElementById('btn-create').addEventListener('click', () => this.openModal());
        document.getElementById('btn-undo').addEventListener('click', () => this.undoLastAction());
        document.getElementById('btn-redo').addEventListener('click', () => this.redoLastAction()); 

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

        form.addEventListener('submit', async (e) => { // Importante: Hacer el callback async
            e.preventDefault();
            const title = document.getElementById('input-title').value;
            const desc = document.getElementById('input-desc').value;
            const status = document.getElementById('input-status').value;

            let taskIdToUse;
            if (this.editingId) {
                await this.updateTask(this.editingId, { title, description: desc, status });
                taskIdToUse = this.editingId;
            } else {
                // Al crear, el ID se genera y se añade al estado local si es exitoso
                await this.createTask(title, desc, status);
                
                // Necesitas encontrar el ID de la tarea recién creada si vas a añadir subtareas temporales
                const latestTask = this.tasks.find(t => t.title === title && t.description === desc);
                if (latestTask) taskIdToUse = latestTask.id;
            }
            
            // Si la tarea se creó o actualizó con éxito, añade las subtareas temporales
            if (taskIdToUse) {
                for (const txt of this.tempSubtasks) {
                    await this.addSubTask(taskIdToUse, txt);
                }
            }

            modal.classList.remove('active');
        });

        document.getElementById('btn-cancel-delete').addEventListener('click', () => {
            document.getElementById('confirm-modal').classList.remove('active');
        });
        document.getElementById('btn-confirm-delete').addEventListener('click', async () => { // Importante: Hacer el callback async
            if(this.deletingId) await this.deleteTask(this.deletingId);
            document.getElementById('confirm-modal').classList.remove('active');
        });
    }

    renderBoard() {
        // ... (Resto del método sin cambios)
    }

    createTaskCard(task) {
        // ... (Resto del método sin cambios)
    }

    openModal(task = null) {
        // ... (Resto del método sin cambios)
    }

    renderTempSubtasks() {
        // ... (Resto del método sin cambios)
    }

    showToast(msg, type = 'info') {
        // ... (Resto del método sin cambios)
    }
}

// Iniciar
const app = new TaskManager();
window.app = app;
