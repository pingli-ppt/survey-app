// 本地缓存题目和逻辑
let tempQuestions = [];
let tempLogic = [];

// 注册/登录示例
function register() { document.getElementById("authResult").innerText = "注册成功（示例）"; }
function login() { document.getElementById("authResult").innerText = "登录成功（示例）"; }

// 渲染选项输入
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

// 渲染校验输入
function renderValidationInputs() {
  const container = document.getElementById("validationContainer");
  const type = document.getElementById("questionType").value;
  container.innerHTML = "";
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

// 添加题目到本地数组
function addQuestionToLocal() {
  const qid = document.getElementById("questionId").value.trim();
  if (!qid) { alert("题目ID不能为空"); return; }
  const type = document.getElementById("questionType").value;
  const required = document.getElementById("required").checked;
  const options = Array.from(document.getElementsByClassName("optionInput"))
                      .map(inp => inp.value).filter(v => v.trim() !== "");

  let validation = {};
  if (type === "multi_choice") {
    validation.min = parseInt(document.getElementById("minSelect").value);
    validation.max = parseInt(document.getElementById("maxSelect").value);
  } else if (type === "text") {
    validation.minLength = parseInt(document.getElementById("minLength").value);
    validation.maxLength = parseInt(document.getElementById("maxLength").value);
  } else if (type === "number") {
    validation.minValue = parseFloat(document.getElementById("minValue").value);
    validation.maxValue = parseFloat(document.getElementById("maxValue").value);
    validation.integerOnly = document.getElementById("integerOnly").checked;
  }

  tempQuestions.push({ qid, type, required, options, validation });
  document.getElementById("addQuestionResult").innerText = `题目 ${qid} 已添加`;
}

// 添加逻辑到本地数组
function addLogicToLocal() {
  const source = document.getElementById("logicSource").value.trim();
  const target = document.getElementById("logicTarget").value.trim();
  const value = document.getElementById("logicValue").value.trim();
  if (!source || !target || !value) { alert("逻辑信息不能为空"); return; }

  tempLogic.push({ source, target, value });
  document.getElementById("addLogicResult").innerText = `逻辑 ${source} -> ${target} 已添加`;
}

// 提交整个问卷
async function submitSurvey() {
  const survey = {
    title: document.getElementById("surveyTitle").value.trim(),
    description: document.getElementById("surveyDesc").value.trim(),
    allowAnonymous: document.getElementById("allowAnon").checked,
    questions: tempQuestions,
    logic: tempLogic
  };
  if (!survey.title) { alert("问卷标题不能为空"); return; }
  if (survey.questions.length === 0) { alert("请至少添加一个题目"); return; }

  try {
    const res = await fetch("/create-survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(survey)
    });
    const result = await res.json();
    document.getElementById("submitSurveyResult").innerText = result.message || "问卷创建成功！";
    tempQuestions = [];
    tempLogic = [];
  } catch (err) {
    console.error(err);
    document.getElementById("submitSurveyResult").innerText = "问卷创建失败";
  }
}

// 以下为示例填答和统计逻辑占位
async function submitResponse() { alert("提交答卷示例"); }
async function fetchStats() { document.getElementById("surveyStats").innerText = "统计结果示例"; }