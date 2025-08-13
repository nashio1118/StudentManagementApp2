import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  Plus,
  Edit,
  Save,
  X,
  Calendar,
  BookOpen,
  TrendingUp,
  User,
} from "lucide-react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import * as Papa from "papaparse";

const initialStudent = {
  name: "",
  grade: "",
  school: "",
  notes: "",
  lessons: [],
  grades: [],
};

const StudentManagementApp = () => {
  const [students, setStudents] = useState([]);
  const [currentView, setCurrentView] = useState("list"); // "list" | "detail" | "add"
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState("info"); // "info" | "lessons" | "grades"
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState(initialStudent);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [newGradeData, setNewGradeData] = useState({ grade: "", testName: "" });
  const [expandedTests, setExpandedTests] = useState({});
  const [gradeFilter, setGradeFilter] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [importPreview, setImportPreview] = useState([]); // プレビュー用
  const [importErrors, setImportErrors] = useState([]); // エラー用
  const [importMode, setImportMode] = useState("append"); // "append" or "overwrite"
  const [showImportModal, setShowImportModal] = useState(false); // モーダル表示
  const [jsonImportMode, setJsonImportMode] = useState("all"); // "all" or "single"
  const [importJsonPreview, setImportJsonPreview] = useState([]);
  const [importJsonErrors, setImportJsonErrors] = useState([]);
  const [showJsonImportModal, setShowJsonImportModal] = useState(false);

  // Firestoreから生徒一覧を取得
  const fetchStudents = async () => {
    const querySnapshot = await getDocs(collection(db, "students"));
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setStudents(data);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // 生徒選択（リスト→詳細画面）
  const selectStudent = (student) => {
    setSelectedStudent(student);
    setCurrentView("detail");
    setActiveTab("info");
    setEditMode(false);
  };

  // 編集開始
  const startEdit = () => {
    setEditMode(true);
    setEditData(selectedStudent);
  };

  // 編集保存
  const saveEdit = async () => {
    if (!editData.id) return;
    const { id, ...updateData } = editData;
    await updateDoc(doc(db, "students", editData.id), updateData);
    setSelectedStudent(editData);
    setEditMode(false);
    fetchStudents();
  };

  // 編集キャンセル
  const cancelEdit = () => {
    setEditMode(false);
    setEditData(initialStudent);
  };

  // 編集データ更新
  const updateEditData = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 授業記録追加
  const addNewLesson = () => {
    const newLesson = {
      date: new Date().toISOString().split("T")[0],
      subject: "",
      instructor: "",
      content: "",
      homework: "",
      comment: "",
    };
    setEditData((prev) => ({
      ...prev,
      lessons: [newLesson, ...(prev.lessons || [])],
    }));
  };

  // 成績追加モーダル表示
  const addNewGrade = () => {
    setNewGradeData({ grade: "", testName: "" });
    setShowGradeModal(true);
  };

  // 成績セット作成
  const createGradeSet = () => {
    if (!newGradeData.grade || !newGradeData.testName) return;
    const subjects = ["国語", "数学", "英語", "社会", "理科"];
    const newGrades = subjects.map((subject) => ({
      subject,
      test: newGradeData.testName,
      grade: newGradeData.grade,
      score: 0,
      maxScore: 100,
      average: 0,
    }));
    newGrades.push({
      subject: "合計点",
      test: newGradeData.testName,
      grade: newGradeData.grade,
      score: 0,
      maxScore: 500,
      average: 0,
    });
    setEditData((prev) => ({
      ...prev,
      grades: [...newGrades, ...(prev.grades || [])],
    }));
    setShowGradeModal(false);
    setNewGradeData({ grade: "", testName: "" });
  };

  // 成績得点更新
  const updateGradeScore = (testName, subject, field, value, gradeGrade) => {
    const newGrades = [...editData.grades];
    const gradeIndex = newGrades.findIndex(
      (g) =>
        g.test === testName && g.subject === subject && g.grade === gradeGrade
    );
    if (gradeIndex !== -1) {
      newGrades[gradeIndex] = {
        ...newGrades[gradeIndex],
        [field]: parseInt(value) || 0,
      };
      if (subject !== "合計点") {
        const testGrades = newGrades.filter(
          (g) =>
            g.test === testName &&
            g.subject !== "合計点" &&
            g.grade === gradeGrade
        );
        const totalScore = testGrades.reduce(
          (sum, g) => sum + (g.score || 0),
          0
        );
        const totalMaxScore = testGrades.reduce(
          (sum, g) => sum + (g.maxScore || 0),
          0
        );
        const totalGradeIndex = newGrades.findIndex(
          (g) =>
            g.test === testName &&
            g.subject === "合計点" &&
            g.grade === gradeGrade
        );
        if (totalGradeIndex !== -1) {
          newGrades[totalGradeIndex] = {
            ...newGrades[totalGradeIndex],
            score: totalScore,
            maxScore: totalMaxScore,
          };
        }
      }
      updateEditData("grades", newGrades);
    }
  };

  // テスト展開切替
  const toggleTestExpansion = (testName) => {
    setExpandedTests((prev) => ({
      ...prev,
      [testName]: !prev[testName],
    }));
  };

  // 生徒追加
  const handleAddStudent = async () => {
    if (!editData.name) return alert("名前を入力してください");
    await addDoc(collection(db, "students"), editData);
    setEditData(initialStudent);
    setCurrentView("list");
    fetchStudents();
  };

  // 生徒削除
  const handleDeleteStudent = async (id) => {
    if (!window.confirm("本当に削除しますか？")) return;

    try {
      console.log("削除開始:", id);
      await deleteDoc(doc(db, "students", id));
      console.log("削除完了");
      await fetchStudents();
    } catch (error) {
      console.error("削除エラー:", error);
      alert("削除に失敗しました: " + error.message);
    }
  };

  const handleExportAll = () => {
    // JSON形式で全データをエクスポート
    const dataStr = JSON.stringify(students, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 学年のバリデーション用リスト
  const validGrades = [
    "小1",
    "小2",
    "小3",
    "小4",
    "小5",
    "小6",
    "中1",
    "中2",
    "中3",
    "高1",
    "高2",
    "高3",
    "その他",
  ];

  // CSVファイル選択時
  const handleCsvFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        const errors = [];
        const preview = [];
        // 既存生徒の重複チェック用
        const existing = new Set(students.map((s) => `${s.name}_${s.grade}`));
        rows.forEach((row, i) => {
          // 必須チェック
          if (!row.名前 || !row.学年) {
            errors.push(`${i + 2}行目: 名前・学年は必須です`);
            return;
          }
          // 学年バリデーション
          if (!validGrades.includes(row.学年)) {
            errors.push(`${i + 2}行目: 学年「${row.学年}」は不正です`);
            return;
          }
          // 重複チェック
          if (existing.has(`${row.名前}_${row.学年}`)) {
            errors.push(
              `${i + 2}行目: 「${row.名前}（${row.学年}）」は既に存在します`
            );
            return;
          }
          preview.push({
            name: row.名前,
            grade: row.学年,
            school: row.学校名 || "",
            notes: row.留意事項 || "",
            lessons: [],
            grades: [],
          });
        });
        setImportPreview(preview);
        setImportErrors(errors);
      },
    });
  };

  // インポート確定時
  const handleImportConfirm = async () => {
    if (importMode === "overwrite") {
      // 既存データ全削除
      for (const s of students) {
        await deleteDoc(doc(db, "students", s.id));
      }
    }
    for (const row of importPreview) {
      await addDoc(collection(db, "students"), row);
    }
    setShowImportModal(false);
    setImportPreview([]);
    setImportErrors([]);
    fetchStudents();
  };

  // JSONファイル選択時
  const handleJsonFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        // 配列でなければ単一生徒として扱う
        if (Array.isArray(data)) {
          setImportJsonPreview(data);
          setJsonImportMode("all");
        } else {
          setImportJsonPreview([data]);
          setJsonImportMode("single");
        }
        setImportJsonErrors([]);
      } catch (err) {
        setImportJsonErrors(["JSONの読み込みに失敗しました"]);
        setImportJsonPreview([]);
      }
    };
    reader.readAsText(file);
  };

  // インポート確定時
  const handleJsonImportConfirm = async () => {
    try {
      if (jsonImportMode === "all") {
        // 全データ上書き
        console.log("既存データを削除中...");

        // 削除処理を確実に完了させる
        const deletePromises = students.map((s) =>
          deleteDoc(doc(db, "students", s.id))
        );
        await Promise.all(deletePromises);

        console.log("削除完了。新しいデータを追加中...");

        // 少し待ってから新しいデータを追加
        await new Promise((resolve) => setTimeout(resolve, 1000));

        for (const row of importJsonPreview) {
          await addDoc(collection(db, "students"), row);
        }

        console.log("追加完了");
      } else if (jsonImportMode === "single") {
        // 選択した生徒のみ上書き
        const target = importJsonPreview[0];
        const existing = students.find(
          (s) => s.name === target.name && s.grade === target.grade
        );
        if (existing) {
          await updateDoc(doc(db, "students", existing.id), target);
        } else {
          await addDoc(collection(db, "students"), target);
        }
      }

      // 画面更新を確実に行う
      console.log("画面を更新中...");
      await fetchStudents();

      setShowJsonImportModal(false);
      setImportJsonPreview([]);
      setImportJsonErrors([]);

      console.log("インポート完了");
    } catch (error) {
      console.error("インポートエラー:", error);
      alert("インポート中にエラーが発生しました: " + error.message);
    }
  };

  // ← ここにリスト画面のUIを追加
  if (currentView === "list") {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-600" />
                生徒管理
              </h1>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">すべての学年</option>
                  <option value="小1">小1</option>
                  <option value="小2">小2</option>
                  <option value="小3">小3</option>
                  <option value="小4">小4</option>
                  <option value="小5">小5</option>
                  <option value="小6">小6</option>
                  <option value="中1">中1</option>
                  <option value="中2">中2</option>
                  <option value="中3">中3</option>
                  <option value="高1">高1</option>
                  <option value="高2">高2</option>
                  <option value="高3">高3</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div className="mb-4">
                <input
                  type="text"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="生徒名で検索"
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div className="mb-4 flex gap-2">
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded-md"
                  onClick={() => {
                    // CSVテンプレートをダウンロード
                    const csv = "名前,学年,学校名,留意事項\n";
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "students_template.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  CSVテンプレートをダウンロード
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                  onClick={() => setShowImportModal(true)}
                >
                  CSVインポート
                </button>
                <button
                  className="px-4 py-2 bg-orange-600 text-white rounded-md"
                  onClick={handleExportAll}
                >
                  全データをバックアップ
                </button>
                <button
                  className="px-4 py-2 bg-purple-600 text-white rounded-md"
                  onClick={() => setShowJsonImportModal(true)}
                >
                  JSONインポート
                </button>
              </div>
              <div className="space-y-3">
                {students
                  .filter(
                    (student) => !gradeFilter || student.grade === gradeFilter
                  )
                  .filter((student) => student.name.includes(nameQuery))
                  .map((student) => (
                    <div
                      key={student.id}
                      className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-3 cursor-pointer flex-1"
                          onClick={() => selectStudent(student)}
                        >
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-800">
                              {student.name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {student.grade}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // 詳細画面に移動するのを防ぐ
                            handleDeleteStudent(student.id);
                          }}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-6">
                <button
                  onClick={() => {
                    setEditData(initialStudent);
                    setEditMode(true);
                    setCurrentView("add");
                  }}
                  className="w-full p-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> 新しい生徒を追加
                </button>
              </div>
            </div>
          </div>
        </div>
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
              <h2 className="text-lg font-bold mb-4">CSVインポート</h2>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFile}
                className="mb-4"
              />
              <div className="mb-2">
                <label>
                  <input
                    type="radio"
                    checked={importMode === "append"}
                    onChange={() => setImportMode("append")}
                  />
                  追加
                </label>
                <label className="ml-4">
                  <input
                    type="radio"
                    checked={importMode === "overwrite"}
                    onChange={() => setImportMode("overwrite")}
                  />
                  既存データを全削除してインポート
                </label>
              </div>
              {importErrors.length > 0 && (
                <div className="mb-2 text-red-600">
                  <ul>
                    {importErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importPreview.length > 0 && (
                <div className="mb-4 max-h-48 overflow-y-auto border p-2 rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th>名前</th>
                        <th>学年</th>
                        <th>学校名</th>
                        <th>留意事項</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row, i) => (
                        <tr key={i}>
                          <td>{row.name}</td>
                          <td>{row.grade}</td>
                          <td>{row.school}</td>
                          <td>{row.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  className="flex-1 px-4 py-2 bg-gray-200 rounded"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportPreview([]);
                    setImportErrors([]);
                  }}
                >
                  キャンセル
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
                  disabled={importPreview.length === 0}
                  onClick={handleImportConfirm}
                >
                  インポート
                </button>
              </div>
            </div>
          </div>
        )}

        {showJsonImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
              <h2 className="text-lg font-bold mb-4">JSONインポート</h2>
              <input
                type="file"
                accept=".json"
                onChange={handleJsonFile}
                className="mb-4"
              />
              {importJsonErrors.length > 0 && (
                <div className="mb-2 text-red-600">
                  <ul>
                    {importJsonErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importJsonPreview.length > 0 && (
                <div className="mb-4 max-h-48 overflow-y-auto border p-2 rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th>名前</th>
                        <th>学年</th>
                        <th>学校名</th>
                        <th>留意事項</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importJsonPreview.map((row, i) => (
                        <tr key={i}>
                          <td>{row.name}</td>
                          <td>{row.grade}</td>
                          <td>{row.school}</td>
                          <td>{row.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mb-2">
                <label>
                  <input
                    type="radio"
                    checked={jsonImportMode === "all"}
                    onChange={() => setJsonImportMode("all")}
                    disabled={
                      importJsonPreview.length !== students.length &&
                      importJsonPreview.length !== 1
                    }
                  />
                  全データをインポート（既存データ全削除）
                </label>
                <label className="ml-4">
                  <input
                    type="radio"
                    checked={jsonImportMode === "single"}
                    onChange={() => setJsonImportMode("single")}
                    disabled={importJsonPreview.length !== 1}
                  />
                  選択した生徒のみインポート（上書き/追加）
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 px-4 py-2 bg-gray-200 rounded"
                  onClick={() => {
                    setShowJsonImportModal(false);
                    setImportJsonPreview([]);
                    setImportJsonErrors([]);
                  }}
                >
                  キャンセル
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
                  disabled={importJsonPreview.length === 0}
                  onClick={handleJsonImportConfirm}
                >
                  インポート
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentView === "add") {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-bold mb-4">新しい生徒を追加</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="名前"
                value={editData.name}
                onChange={(e) => updateEditData("name", e.target.value)}
                className="w-full p-2 border rounded-md"
              />
              <select
                value={editData.grade}
                onChange={(e) => updateEditData("grade", e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">学年を選択してください</option>
                <option value="小1">小1</option>
                <option value="小2">小2</option>
                <option value="小3">小3</option>
                <option value="小4">小4</option>
                <option value="小5">小5</option>
                <option value="小6">小6</option>
                <option value="中1">中1</option>
                <option value="中2">中2</option>
                <option value="中3">中3</option>
                <option value="高1">高1</option>
                <option value="高2">高2</option>
                <option value="高3">高3</option>
                <option value="その他">その他</option>
              </select>
              <input
                type="text"
                placeholder="学校名"
                value={editData.school}
                onChange={(e) => updateEditData("school", e.target.value)}
                className="w-full p-2 border rounded-md"
              />
              <textarea
                placeholder="留意事項"
                value={editData.notes}
                onChange={(e) => updateEditData("notes", e.target.value)}
                className="w-full p-2 border rounded-md"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setCurrentView("list");
                    setEditMode(false);
                  }}
                  className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddStudent}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "detail" && selectedStudent) {
    const displayData = editMode ? editData : selectedStudent;
    return (
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <div className="bg-white shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronLeft
                className="w-6 h-6 text-gray-600 cursor-pointer"
                onClick={() => setCurrentView("list")}
              />
              <h1 className="text-lg font-semibold text-gray-800">
                {displayData.name}
              </h1>
            </div>
            <div className="flex gap-2">
              {editMode ? (
                <>
                  <button
                    onClick={saveEdit}
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={startEdit}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => handleDeleteStudent(selectedStudent.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        {/* タブナビゲーション */}
        <div className="bg-white border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab("info")}
              className={`flex-1 py-3 px-4 text-center border-b-2 ${
                activeTab === "info"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500"
              }`}
            >
              <User className="w-5 h-5 mx-auto mb-1" />
              <span className="text-sm">基本情報</span>
            </button>
            <button
              onClick={() => setActiveTab("lessons")}
              className={`flex-1 py-3 px-4 text-center border-b-2 ${
                activeTab === "lessons"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500"
              }`}
            >
              <Calendar className="w-5 h-5 mx-auto mb-1" />
              <span className="text-sm">授業記録</span>
            </button>
            <button
              onClick={() => setActiveTab("grades")}
              className={`flex-1 py-3 px-4 text-center border-b-2 ${
                activeTab === "grades"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500"
              }`}
            >
              <TrendingUp className="w-5 h-5 mx-auto mb-1" />
              <span className="text-sm">成績</span>
            </button>
          </div>
        </div>
        {/* コンテンツ */}
        <div className="p-4">
          {activeTab === "info" && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名前
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => updateEditData("name", e.target.value)}
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-800">{displayData.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    学年
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editData.grade}
                      onChange={(e) => updateEditData("grade", e.target.value)}
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-800">{displayData.grade}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    学校名
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editData.school}
                      onChange={(e) => updateEditData("school", e.target.value)}
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-800">{displayData.school}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    留意事項
                  </label>
                  {editMode ? (
                    <textarea
                      value={editData.notes}
                      onChange={(e) => updateEditData("notes", e.target.value)}
                      rows={3}
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-800">{displayData.notes}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === "lessons" && (
            <div className="space-y-4">
              {editMode && (
                <button
                  onClick={addNewLesson}
                  className="w-full p-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> 新しい授業記録を追加
                </button>
              )}
              {(displayData.lessons || []).map((lesson, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          日付
                        </label>
                        {editMode ? (
                          <input
                            type="date"
                            value={lesson.date}
                            onChange={(e) => {
                              const newLessons = [...editData.lessons];
                              newLessons[index] = {
                                ...lesson,
                                date: e.target.value,
                              };
                              updateEditData("lessons", newLessons);
                            }}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <p className="text-sm text-gray-600">{lesson.date}</p>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          科目
                        </label>
                        {editMode ? (
                          <input
                            type="text"
                            value={lesson.subject}
                            onChange={(e) => {
                              const newLessons = [...editData.lessons];
                              newLessons[index] = {
                                ...lesson,
                                subject: e.target.value,
                              };
                              updateEditData("lessons", newLessons);
                            }}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <p className="text-sm font-semibold text-blue-600">
                            {lesson.subject}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          担当講師
                        </label>
                        {editMode ? (
                          <input
                            type="text"
                            value={lesson.instructor}
                            onChange={(e) => {
                              const newLessons = [...editData.lessons];
                              newLessons[index] = {
                                ...lesson,
                                instructor: e.target.value,
                              };
                              updateEditData("lessons", newLessons);
                            }}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <p className="text-sm text-gray-600">
                            {lesson.instructor}
                          </p>
                        )}
                      </div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        内容
                      </label>
                      {editMode ? (
                        <textarea
                          value={lesson.content}
                          onChange={(e) => {
                            const newLessons = [...editData.lessons];
                            newLessons[index] = {
                              ...lesson,
                              content: e.target.value,
                            };
                            updateEditData("lessons", newLessons);
                          }}
                          rows={3}
                          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <p className="text-gray-800 whitespace-pre-line">
                          {lesson.content}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        宿題
                      </label>
                      {editMode ? (
                        <textarea
                          value={lesson.homework}
                          onChange={(e) => {
                            const newLessons = [...editData.lessons];
                            newLessons[index] = {
                              ...lesson,
                              homework: e.target.value,
                            };
                            updateEditData("lessons", newLessons);
                          }}
                          rows={3}
                          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <p className="text-gray-800 whitespace-pre-line">
                          {lesson.homework}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        コメント
                      </label>
                      {editMode ? (
                        <textarea
                          value={lesson.comment}
                          onChange={(e) => {
                            const newLessons = [...editData.lessons];
                            newLessons[index] = {
                              ...lesson,
                              comment: e.target.value,
                            };
                            updateEditData("lessons", newLessons);
                          }}
                          rows={2}
                          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <p className="text-gray-800">{lesson.comment}</p>
                      )}
                    </div>
                    {editMode && (
                      <button
                        onClick={() => {
                          const newLessons = editData.lessons.filter(
                            (_, i) => i !== index
                          );
                          updateEditData("lessons", newLessons);
                        }}
                        className="text-red-500 text-xs mt-2"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "grades" && (
            <div className="space-y-4">
              {editMode && (
                <button
                  onClick={addNewGrade}
                  className="w-full p-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> 新しい成績を追加
                </button>
              )}
              {(() => {
                const grades = displayData.grades || [];
                const groupedGrades = grades.reduce((acc, grade) => {
                  // 学年とテスト名を組み合わせたキーを作成
                  const groupKey = `${grade.grade || "未設定"}_${
                    grade.test || "その他"
                  }`;
                  if (!acc[groupKey]) acc[groupKey] = [];
                  acc[groupKey].push(grade);
                  return acc;
                }, {});
                return Object.entries(groupedGrades)
                  .sort((a, b) => {
                    const aFirstIndex = grades.findIndex(
                      (g) =>
                        `${g.grade || "未設定"}_${g.test || "その他"}` === a[0]
                    );
                    const bFirstIndex = grades.findIndex(
                      (g) =>
                        `${g.grade || "未設定"}_${g.test || "その他"}` === b[0]
                    );
                    return aFirstIndex - bFirstIndex;
                  })
                  .map(([groupKey, testGrades]) => {
                    const [gradeLabel, testLabel] = groupKey.split("_");
                    const isExpanded = expandedTests[groupKey];
                    const totalGrade = testGrades.find(
                      (g) => g.subject === "合計点"
                    );
                    return (
                      <div
                        key={groupKey}
                        className="bg-white rounded-lg shadow-sm"
                      >
                        <div
                          className="bg-blue-50 p-3 border-b cursor-pointer hover:bg-blue-100 transition-colors"
                          onClick={() => toggleTestExpansion(groupKey)}
                        >
                          <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-blue-800">
                              {gradeLabel} {testLabel}
                            </h3>
                            <div className="flex items-center gap-2">
                              {totalGrade && (
                                <span className="text-sm text-blue-600">
                                  合計: {totalGrade.score}/{totalGrade.maxScore}
                                </span>
                              )}
                              <ChevronLeft
                                className={`w-4 h-4 text-blue-600 transform transition-transform ${
                                  isExpanded ? "rotate-90" : "-rotate-90"
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="p-3 space-y-3">
                            {testGrades.map((grade, index) => {
                              const originalIndex = grades.indexOf(grade);
                              return (
                                <div
                                  key={originalIndex}
                                  className="border rounded-lg p-3"
                                >
                                  <div className="flex gap-2 mb-3">
                                    <div className="flex-1">
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        科目
                                      </label>
                                      <p className="text-sm font-semibold text-blue-600">
                                        {grade.subject}
                                      </p>
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        学年
                                      </label>
                                      <p className="text-sm text-gray-600">
                                        {grade.grade}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        得点
                                      </label>
                                      {editMode &&
                                      grade.subject !== "合計点" ? (
                                        <input
                                          type="number"
                                          value={grade.score || ""}
                                          onChange={(e) =>
                                            updateGradeScore(
                                              testLabel,
                                              grade.subject,
                                              "score",
                                              e.target.value,
                                              grade.grade
                                            )
                                          }
                                          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                      ) : (
                                        <p className="text-lg font-bold text-gray-800">
                                          {grade.score}
                                        </p>
                                      )}
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        満点
                                      </label>
                                      {editMode &&
                                      grade.subject !== "合計点" ? (
                                        <input
                                          type="number"
                                          value={grade.maxScore || ""}
                                          onChange={(e) =>
                                            updateGradeScore(
                                              testLabel,
                                              grade.subject,
                                              "maxScore",
                                              e.target.value,
                                              grade.grade
                                            )
                                          }
                                          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                      ) : (
                                        <p className="text-lg text-gray-600">
                                          {grade.maxScore}
                                        </p>
                                      )}
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        平均点
                                      </label>
                                      {editMode &&
                                      grade.subject !== "合計点" ? (
                                        <input
                                          type="number"
                                          value={grade.average || ""}
                                          onChange={(e) =>
                                            updateGradeScore(
                                              testLabel,
                                              grade.subject,
                                              "average",
                                              e.target.value,
                                              grade.grade
                                            )
                                          }
                                          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                      ) : (
                                        <p className="text-lg text-gray-600">
                                          {grade.average}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {editMode && (
                                    <button
                                      onClick={() => {
                                        const newGrades =
                                          editData.grades.filter(
                                            (_, i) => i !== originalIndex
                                          );
                                        updateEditData("grades", newGrades);
                                      }}
                                      className="text-red-500 text-xs mt-2"
                                    >
                                      削除
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
              })()}
            </div>
          )}
        </div>

        {/* 成績追加モーダル */}
        {showGradeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-80 max-w-sm mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                学年・テスト名を入力してください
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    学年
                  </label>
                  <select
                    value={newGradeData.grade}
                    onChange={(e) =>
                      setNewGradeData((prev) => ({
                        ...prev,
                        grade: e.target.value,
                      }))
                    }
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">選択してください</option>
                    <option value="中1">中1</option>
                    <option value="中2">中2</option>
                    <option value="中3">中3</option>
                    <option value="高1">高1</option>
                    <option value="高2">高2</option>
                    <option value="高3">高3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    テスト名
                  </label>
                  <input
                    type="text"
                    value={newGradeData.testName}
                    onChange={(e) =>
                      setNewGradeData((prev) => ({
                        ...prev,
                        testName: e.target.value,
                      }))
                    }
                    placeholder="例: 1学期期末テスト"
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowGradeModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={createGradeSet}
                  disabled={!newGradeData.grade || !newGradeData.testName}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  作成
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default StudentManagementApp;
