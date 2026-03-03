async function fetchTasks() {
    const response = await fetch('/tasks');
    const tasks = await response.json();
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.textContent = task.title;
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

fetchTasks();

document.getElementById('addBtn').addEventListener('click', addTask);