async function fetchTasks() {
    const response = await fetch('/tasks');
    const tasks = await response.json();
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');

        const span = document.createElement('span');
        span.textContent = task.title;

        const btn = document.createElement('button');
        btn.textContent = '🗑️';
        btn.style.background = '#dc3545';
        btn.style.padding = '5px 10px';
        btn.addEventListener('click', () => deleteTask(task._id));

        li.appendChild(span);
        li.appendChild(btn);
        list.appendChild(li);
    });
}

async function addTask() {
    const input = document.getElementById('taskInput');
    if (!input.value) return;

    await fetch('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: input.value })
    });

    input.value = '';
    fetchTasks();
}

async function deleteTask(id) {
    await fetch(`/tasks/${id}`, {
        method: 'DELETE'
    });
    fetchTasks();
}

fetchTasks();

document.getElementById('addBtn').addEventListener('click', addTask);