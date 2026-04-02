// main.js - 完整版

// 全局变量
let currentUser = null;
let currentToken = null;
let currentSurvey = null;
let currentAnswers = {};

// 存储token
function saveToken(token, user) {
    currentToken = token;
    currentUser = user;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
}

// 加载token
function loadToken() {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    if (token && user) {
        currentToken = token;
        currentUser = JSON.parse(user);
        return true;
    }
    return false;
}

// 获取认证头
function getAuthHeaders() {
    return currentToken ? { "Authorization": `Bearer ${currentToken}` } : {};
}

// ========== 用户认证 ==========
async function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const email = document.getElementById("email")?.value || "";
    
    if (!username || !password) {
        alert("用户名和密码不能为空");
        return;
    }
    
    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, email })
        });
        const result = await res.json();
        if (res.ok) {
            saveToken(result.token, result.user);
            document.getElementById("authResult").innerHTML = `✅ 注册成功！欢迎 ${username}`;
            updateLoginStatus();
            loadMySurveys();
        } else {
            document.getElementById("authResult").innerHTML = `❌ ${result.error}`;
        }
    } catch (err) {
        console.error(err);
        document.getElementById("authResult").innerHTML = "❌ 注册失败";
    }
}

async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    if (!username || !password) {
        alert("用户名和密码不能为空");
        return;
    }
    
    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const result = await res.json();
        if (res.ok) {
            saveToken(result.token, result.user);
            document.getElementById("authResult").innerHTML = `✅ 登录成功！欢迎 ${username}`;
            updateLoginStatus();
            loadMySurveys();
        } else {
            document.getElementById("authResult").innerHTML = `❌ ${result.error}`;
        }
    } catch (err) {
        console.error(err);
        document.getElementById("authResult").innerHTML = "❌ 登录失败";
    }
}

function logout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    updateLoginStatus();
    document.getElementById("mySurveysList").innerHTML = "";
    document.getElementById("authResult").innerHTML = "✅ 已退出登录";
}

function updateLoginStatus() {
    const statusDiv = document.getElementById("loginStatus");
    if (statusDiv) {
        if (currentUser) {
            statusDiv.innerHTML = `👤 ${currentUser.username} | <button onclick="logout()">退出</button>`;
        } else {
            statusDiv.innerHTML = "未登录";
        }
    }
}

// ========== 加载我的问卷 ==========
async function loadMySurveys() {
    if (!currentToken) return;
    
    try {
        const res = await fetch("/my-surveys", {
            headers: getAuthHeaders()
        });
        const surveys = await res.json();
        
        const select = document.getElementById("selectSurvey");
        const listDiv = document.getElementById("mySurveysList");
        
        if (select) {
            select.innerHTML = '<option value="">选择问卷</option>';
            surveys.forEach(s => {
                select.innerHTML += `<option value="${s.surveyId}">${s.title}</option>`;
            });
        }
        
        if (listDiv) {
            if (surveys.length === 0) {
                listDiv.innerHTML = "<p>暂无问卷，请创建新问卷</p>";
            } else {
                listDiv.innerHTML = surveys.map(s => `
                    <div class="survey-item">
                        <strong>${s.title}</strong><br>
                        说明: ${s.description || "无"}<br>
                        状态: ${s.status} | 答卷数: ${s.responseCount || 0}<br>
                        <button onclick="viewSurveyStats('${s.surveyId}')">查看统计</button>
                        <button onclick="viewSurvey('${s.surveyId}')">填写问卷</button>
                        <hr>
                    </div>
                `).join("");
            }
        }
    } catch (err) {
        console.error(err);
    }
}

// ========== 查看统计 ==========
async function viewSurveyStats(surveyId) {
    if (!currentToken) {
        alert("请先登录");
        return;
    }
    
    try {
        const res = await fetch(`/get-survey-stats?surveyId=${surveyId}`, {
            headers: getAuthHeaders()
        });
        const stats = await res.json();
        
        if (res.ok) {
            displayStats(stats);
        } else {
            alert(stats.error);
        }
    } catch (err) {
        console.error(err);
        alert("获取统计失败");
    }
}

function displayStats(stats) {
    const container = document.getElementById("surveyStats");
    if (!container) return;
    
    let html = `<h3>📊 统计结果</h3>`;
    html += `<p>总答卷数: ${stats.totalResponses}</p>`;
    
    for (const [qId, qStat] of Object.entries(stats.questions)) {
        html += `<div class="stat-question"><strong>${qId}</strong> (${qStat.type})<br>`;
        
        if (qStat.type === "single_choice") {
            html += `<ul>`;
            for (const [opt, count] of Object.entries(qStat.options)) {
                const percent = qStat.totalAnswers > 0 ? ((count / qStat.totalAnswers) * 100).toFixed(1) : 0;
                html += `<li>${opt}: ${count} 人 (${percent}%)</li>`;
            }
            html += `</ul>`;
        } else if (qStat.type === "multi_choice") {
            html += `<ul>`;
            for (const [opt, count] of Object.entries(qStat.options)) {
                html += `<li>${opt}: 被选 ${count} 次</li>`;
            }
            html += `</ul>`;
            html += `<p>总选择次数: ${qStat.totalSelections || 0}</p>`;
        } else if (qStat.type === "text") {
            html += `<p>回答列表:</p><ul>`;
            qStat.answers.forEach(a => {
                html += `<li>${a}</li>`;
            });
            html += `</ul>`;
        } else if (qStat.type === "number") {
            html += `<p>平均值: ${qStat.avg || 0}</p>`;
            html += `<p>最小值: ${qStat.min || "-"}</p>`;
            html += `<p>最大值: ${qStat.max || "-"}</p>`;
            html += `<p>样本数: ${qStat.values?.length || 0}</p>`;
        }
        
        html += `</div><hr>`;
    }
    
    container.innerHTML = html;
}

// ========== 创建问卷 ==========
let tempQuestions = [];
let tempLogic = [];

function renderOptionsInput() {
    const container = document.getElementById("optionsContainer");
    const type = document.getElementById("questionType").value;
    if (!container) return;
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

function renderValidationInputs() {
    const container = document.getElementById("validationContainer");
    const type = document.getElementById("questionType").value;
    if (!container) return;
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

function addQuestionToLocal() {
    const qid = document.getElementById("questionId").value.trim();
    if (!qid) { alert("题目ID不能为空"); return; }
    const type = document.getElementById("questionType").value;
    const required = document.getElementById("required").checked;
    const options = Array.from(document.getElementsByClassName("optionInput"))
                        .map(inp => inp.value).filter(v => v.trim() !== "");
    
    let config = {};
    if (type === "single_choice" && options.length > 0) {
        config.options = options.map(opt => ({ value: opt, label: opt }));
    } else if (type === "multi_choice") {
        config.options = options.map(opt => ({ value: opt, label: opt }));
        config.minSelect = parseInt(document.getElementById("minSelect")?.value || 1);
        config.maxSelect = parseInt(document.getElementById("maxSelect")?.value || 3);
    } else if (type === "text") {
        config.minLength = parseInt(document.getElementById("minLength")?.value || 0);
        config.maxLength = parseInt(document.getElementById("maxLength")?.value || 100);
    } else if (type === "number") {
        config.minValue = parseFloat(document.getElementById("minValue")?.value || 0);
        config.maxValue = parseFloat(document.getElementById("maxValue")?.value || 120);
        config.integerOnly = document.getElementById("integerOnly")?.checked || false;
    }
    
    tempQuestions.push({ questionId: qid, type, required, config, logic: [] });
    document.getElementById("addQuestionResult").innerHTML = `✅ 题目 ${qid} 已添加`;
}

function addLogicToLocal() {
    const source = document.getElementById("logicSource").value.trim();
    const target = document.getElementById("logicTarget").value.trim();
    const value = document.getElementById("logicValue").value.trim();
    if (!source || !target || !value) { alert("逻辑信息不能为空"); return; }
    
    tempLogic.push({ sourceQuestionId: source, targetQuestionId: target, optionValue: value });
    document.getElementById("addLogicResult").innerHTML = `✅ 逻辑 ${source} -> ${target} 已添加`;
}

async function submitSurvey() {
    if (!currentToken) {
        alert("请先登录");
        return;
    }

    const title = document.getElementById("surveyTitle")?.value.trim();
    const description = document.getElementById("surveyDesc")?.value.trim();

    if (!title) {
        alert("问卷标题不能为空");
        return;
    }

    if (tempQuestions.length === 0) {
        alert("请至少添加一个题目");
        return;
    }

    try {
        // ✅ 第一步：创建问卷
        const res = await fetch("/api/create-survey", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                title,
                description,
                allowAnonymous: true
            })
        });

        const data = await res.json();

        if (!data.success) {
            alert("创建问卷失败：" + data.error);
            return;
        }

        const surveyId = data.survey.surveyId;

        // ✅ 第二步：添加题目
        for (const q of tempQuestions) {
            const qRes = await fetch("/api/add-question", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    surveyId,
                    questionId: q.questionId,
                    title: q.questionId,
                    type: q.type,
                    required: q.required,
                    config: q.config
                })
            });

            const qData = await qRes.json();
            if (!qData.success) {
                console.error("添加题目失败:", qData.error);
            }
        }

        // ✅ 完成
        document.getElementById("submitSurveyResult").innerHTML =
            `✅ 创建成功！问卷ID：${surveyId}`;

        tempQuestions = [];
        loadMySurveys();

    } catch (err) {
        console.error(err);
        alert("创建失败");
    }
}
// ========== 填写问卷 ==========
async function viewSurvey(surveyId) {
    try {
        const res = await fetch(`/get-survey?surveyId=${surveyId}`);
        const survey = await res.json();
        if (res.ok) {
            currentSurvey = survey;
            renderSurveyQuestions(survey);
        } else {
            alert(survey.error);
        }
    } catch (err) {
        console.error(err);
        alert("获取问卷失败");
    }
}

function renderSurveyQuestions(survey) {
    const container = document.getElementById("questionArea");
    if (!container) return;
    
    let html = `<h3>${survey.title}</h3>`;
    html += `<p>${survey.description || ""}</p>`;
    
    survey.questions.forEach((q, idx) => {
        html += `<div class="questionBlock" data-qid="${q.questionId}">`;
        html += `<strong>${q.questionId}. ${q.required ? "【必填】" : ""}</strong><br>`;
        
        if (q.type === "single_choice" && q.config?.options) {
            q.config.options.forEach(opt => {
                html += `<label><input type="radio" name="q_${q.questionId}" value="${opt.value}"> ${opt.label}</label><br>`;
            });
        } else if (q.type === "multi_choice" && q.config?.options) {
            q.config.options.forEach(opt => {
                html += `<label><input type="checkbox" name="q_${q.questionId}" value="${opt.value}"> ${opt.label}</label><br>`;
            });
        } else if (q.type === "text") {
            html += `<input type="text" name="q_${q.questionId}" placeholder="请输入文本">`;
        } else if (q.type === "number") {
            html += `<input type="number" name="q_${q.questionId}" placeholder="请输入数字">`;
        }
        
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

async function submitResponse() {
    if (!currentSurvey) {
        alert("请先加载问卷");
        return;
    }
    
    const answers = [];
    currentSurvey.questions.forEach(q => {
        const inputs = document.querySelectorAll(`[name="q_${q.questionId}"]`);
        let value = null;
        
        if (q.type === "single_choice") {
            const selected = Array.from(inputs).find(inp => inp.checked);
            value = selected ? selected.value : null;
        } else if (q.type === "multi_choice") {
            value = Array.from(inputs).filter(inp => inp.checked).map(inp => inp.value);
        } else {
            const input = inputs[0];
            value = input ? input.value : null;
        }
        
        answers.push({ questionId: q.questionId, type: q.type, value });
    });
    
    try {
        const res = await fetch("/submit-response", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                surveyId: currentSurvey.surveyId,
                respondentName: currentUser?.username || "匿名",
                isAnonymous: !currentUser,
                answers
            })
        });
        const result = await res.json();
        if (res.ok) {
            document.getElementById("submitResult").innerHTML = `✅ ${result.message}`;
        } else {
            document.getElementById("submitResult").innerHTML = `❌ ${result.error}`;
        }
    } catch (err) {
        console.error(err);
        document.getElementById("submitResult").innerHTML = "❌ 提交失败";
    }
}

async function fetchStats() {
    if (!currentSurvey) {
        alert("请先加载问卷");
        return;
    }
    await viewSurveyStats(currentSurvey.surveyId);
}

// 页面加载时初始化
window.onload = () => {
    if (loadToken()) {
        updateLoginStatus();
        loadMySurveys();
    }
    
    // 绑定事件
    const typeSelect = document.getElementById("questionType");
    if (typeSelect) {
        typeSelect.addEventListener("change", () => {
            renderOptionsInput();
            renderValidationInputs();
        });
        renderOptionsInput();
        renderValidationInputs();
    }
};