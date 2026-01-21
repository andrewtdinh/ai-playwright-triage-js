export function createLists(elements, api, handlers) {
  const { storyList, testList } = elements;
  const {
    onEditStory,
    onDeleteStory,
    onGenerateForStory,
    onEditTest,
    onDeleteTest,
    onRunTest,
  } = handlers;

  async function loadStories() {
    const response = await api.getStories();
    const files = response.data.files || [];

    storyList.innerHTML = "";
    for (const f of files) {
      const li = document.createElement("li");
      li.className = "story-item";

      const name = document.createElement("span");
      name.textContent = f;

      const actions = document.createElement("span");
      actions.className = "story-actions";

      const generateBtn = document.createElement("button");
      generateBtn.className = "btn small generate";
      generateBtn.textContent = "Generate";
      generateBtn.addEventListener("click", () => onGenerateForStory(f));

      const editBtn = document.createElement("button");
      editBtn.className = "btn small";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => onEditStory(f));

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn small danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => onDeleteStory(f));

      actions.appendChild(generateBtn);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      li.appendChild(name);
      li.appendChild(actions);
      storyList.appendChild(li);
    }
  }

  async function loadTests() {
    const response = await api.getTests();
    const files = response.data.files || [];
    testList.innerHTML = "";
    for (const f of files) {
      const li = document.createElement("li");
      li.className = "story-item";

      const name = document.createElement("span");
      name.textContent = f;

      const actions = document.createElement("span");
      actions.className = "story-actions";

      const runBtn = document.createElement("button");
      runBtn.className = "btn small generate";
      runBtn.textContent = "Run";
      runBtn.addEventListener("click", () => onRunTest(f));

      const editBtn = document.createElement("button");
      editBtn.className = "btn small";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => onEditTest(f));

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn small danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => onDeleteTest(f));

      actions.appendChild(runBtn);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      li.appendChild(name);
      li.appendChild(actions);
      testList.appendChild(li);
    }
  }

  return { loadStories, loadTests };
}
