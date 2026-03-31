let surveys = [];
let currentSurvey = null;
let currentIndex = 0;
let answers = [];

// 加载问卷列表
async function loadUserSurveys() {
  const res = await fetch("/my-surveys");
  surveys = await res.json();

  const selects = [document.getElementById("selectSurvey"), document.getElementById("logicSurvey")];
  selects.forEach(select => {
    select.innerHTML = "";
    surveys.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.surveyId;
      opt.text = s.title;
      select.add(opt);
    });
  });

  renderOptionsInput();
  renderValidationInputs();
}

// 渲染选项输入框
function renderOptionsInput() {
  const container = document.getElementById("optionsContainer");
  const type = document.getElementById("questionType").value;
  container.innerHTML = "";
  if (type === "single_choice" || type === "multi_choice") {
    for (let i = 1; i <= 4; i++) {
      const inp = document.createElement("input");
      inp.className = "optionInput";
      inp.placeholder = "选项" + i;
      container.appendChild(inp);
      container.appendChild(document.createElement("br"));
    }
  }
}

// 渲染校验输入框
function renderValidationInputs() {
  const container = document.getElementById("validationContainer");
  container.innerHTML = "";
  const type = document.getElementById("questionType").value;

  if (type === "multi_choice") {
    container.innerHTML = `
      <label>最少选择 <input type="number" id="minSelect" value="1"></label>
      <label>最多选择 <input type="number" id="maxSelect" value="3"></label>
    `;
  } else if (type === "text") {
    container.innerHTML = `
      <label>最少字数 <input type="number" id="minLength" value="0"></label>
      <label>最多字数 <input type="number" id="maxLength" value="100"></label>
    `;
  } else if (type === "number") {
    container.innerHTML = `
      <label>最小值 <input type="number" id="minValue" value="0"></label>
      <label>最大值 <input type="number" id="maxValue" value="120"></label>
      <label>整数 <input type="checkbox" id="integerOnly" checked></label>
    `;
  }
}

document.getElementById("questionType").addEventListener("change", () => {
  renderOptionsInput();
  renderValidationInputs();
});

// 添加题目
async function addQuestion() {
  const surveyId = document.getElementById("selectSurvey").value;
  const questionId = document.getElementById("questionId").value;
  const type = document.getElementById("questionType").value;
  const required = document.getElementById("required").checked;

  const options = Array.from(document.getElementsByClassName("optionInput"))
    .map(i => i.value).filter(v => v);

  const config = {};
  if (type === "single_choice" || type === "multi_choice") {
    config.options = options.map(v => ({ value: v, label: v }));
  }
  if (type === "multi_choice") {
    config.minSelect = Number(document.getElementById("minSelect").value);
    config.maxSelect = Number(document.getElementById("maxSelect").value);
  }
  if (type === "text") {
    config.minLength = Number(document.getElementById("minLength").value);
    config.maxLength = Number(document.getElementById("maxLength").value);
  }
  if (type === "number") {
    config.minValue = Number(document.getElementById("minValue").value);
    config.maxValue = Number(document.getElementById("maxValue").value);
    config.integerOnly = document.getElementById("integerOnly").checked;
  }

  const res = await fetch("/add-question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surveyId, questionId, type, required, config })
  });
  const data = await res.json();
  document.getElementById("addQuestionResult").innerText = data.message;
}

// 添加跳转逻辑
async function addLogic() {
  const surveyId = document.getElementById("logicSurvey").value;
  const sourceQuestionId = document.getElementById("logicSource").value;
  const targetQuestionId = document.getElementById("logicTarget").value;
  const optionValue = document.getElementById("logicValue").value;

  const res = await fetch("/add-logic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surveyId, sourceQuestionId, targetQuestionId, optionValue })
  });
  const data = await res.json();
  document.getElementById("addLogicResult").innerText = data.message;
}

// 填写问卷
async function loadSurvey(surveyId) {
  const res = await fetch(`/get-survey?surveyId=${surveyId}`);
  currentSurvey = await res.json();
  currentIndex = 0;
  answers = [];
  renderQuestion();
}

function renderQuestion() {
  if (!currentSurvey || currentIndex >= currentSurvey.questions.length) {
    document.getElementById("questionArea").innerHTML = "问卷结束";
    return;
  }

  const q = currentSurvey.questions[currentIndex];
  const container = document.getElementById("questionArea");
  container.innerHTML = `<div class="questionBlock">
    <strong>${q.questionId}. ${q.type}</strong><br>
    <div id="optionsBlock"></div>
    <button onclick="nextQuestion()">下一题</button>
  </div>`;

  const optsBlock = document.getElementById("optionsBlock");
  if (q.type === "single_choice") {
    q.config.options.forEach(opt => {
      optsBlock.innerHTML += `<label><input type="radio" name="q${currentIndex}" value="${opt.value}"> ${opt.label}</label>`;
    });
  } else if (q.type === "multi_choice") {
    q.config.options.forEach(opt => {
      optsBlock.innerHTML += `<label><input type="checkbox" name="q${currentIndex}" value="${opt.value}"> ${opt.label}</label>`;
    });
  } else if (q.type === "text" || q.type === "number") {
    optsBlock.innerHTML += `<input type="${q.type === "number" ? "number" : "text"}" id="qInput${currentIndex}">`;
  }
}

function nextQuestion() {
  const q = currentSurvey.questions[currentIndex];
  let ans = null;

  if (q.type === "single_choice") {
    const selected = document.querySelector(`input[name="q${currentIndex}"]:checked`);
    ans = selected ? selected.value : null;
    if (q.required && !ans) { alert("必填题未回答"); return; }
  } else if (q.type === "multi_choice") {
    const selected = Array.from(document.querySelectorAll(`input[name="q${currentIndex}"]:checked`)).map(i => i.value);
    ans = selected;
    if (q.required && selected.length < q.config.minSelect) { alert(`至少选择 ${q.config.minSelect} 项`); return; }
    if (selected.length > q.config.maxSelect) { alert(`最多选择 ${q.config.maxSelect} 项`); return; }
  } else if (q.type === "text") {
    ans = document.getElementById(`qInput${currentIndex}`).value;
    if (q.required && ans.length < q.config.minLength) { alert(`最少输入 ${q.config.minLength} 个字`); return; }
    if (ans.length > q.config.maxLength) { alert(`最多输入 ${q.config.maxLength} 个字`); return; }
  } else if (q.type === "number") {
    ans = Number(document.getElementById(`qInput${currentIndex}`).value);
    if (q.required && (ans < q.config.minValue || ans > q.config.maxValue)) { alert(`数字范围应在 ${q.config.minValue}~${q.config.maxValue}`); return; }
    if (q.config.integerOnly && !Number.isInteger(ans)) { alert(`必须为整数`); return; }
  }

  answers.push({ questionId: q.questionId, value: ans });

  // 跳转逻辑
  let nextIndex = currentIndex + 1;
  if (q.logic && q.logic.length) {
    for (let rule of q.logic) {
      if ((Array.isArray(ans) && ans.includes(rule.conditions[0].optionValue)) || ans === rule.conditions[0].optionValue) {
        const targetIdx = currentSurvey.questions.findIndex(qq => qq.questionId === rule.targetQuestionId);
        if (targetIdx !== -1) nextIndex = targetIdx;
      }
    }
  }

  currentIndex = nextIndex;
  renderQuestion();
}

async function submitResponse() {
  if (!currentSurvey) return;
  const res = await fetch("/submit-response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surveyId: currentSurvey.surveyId, answers })
  });
  const data = await res.json();
  document.getElementById("submitResult").innerText = data.message;
}

async function fetchStats() {
  if (!currentSurvey) return;
  const res = await fetch(`/get-survey-stats?surveyId=${currentSurvey.surveyId}`);
  const stats = await res.json();
  document.getElementById("surveyStats").innerHTML = JSON.stringify(stats, null, 2);
}

// 页面加载
window.onload = loadUserSurveys;