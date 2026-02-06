"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

interface Category {
  id: number;
  name: string;
  sort: number;
  is_active: boolean;
}

interface SubCategory {
  id: number;
  name: string;
  category_id: number | null;
}

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState<number[]>(
    [],
  );
  const [categoryVersion, setCategoryVersion] = useState(1);

  // 添加分类相关状态
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sort: 0,
    is_active: true,
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const [catRes, subRes, versionRes] = await Promise.all([
              fetch("/api/admin-api/categories", {
                headers: { Authorization: `Bearer ${token}` },
              }),
              fetch("/api/admin-api/sub-categories", {
                headers: { Authorization: `Bearer ${token}` },
              }),
              fetch("/api/admin-api/category-version", {
                headers: { Authorization: `Bearer ${token}` },
              }),
            ]);

      if (catRes.ok && subRes.ok) {
        const catData = await catRes.json();
        const subData = await subRes.json();
        setCategories(catData.data);
        setSubCategories(subData.data);
      }

      if (versionRes.ok) {
        const versionData = await versionRes.json();
        setCategoryVersion(versionData.data?.version || 1);
      }
    } catch (error) {
      console.error("获取分类失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVersion = async () => {
    const newVersion = prompt("请输入新的版本号：", categoryVersion.toString());
    if (newVersion === null) return;

    const versionNum = parseInt(newVersion, 10);
    if (isNaN(versionNum) || versionNum < 1) {
      alert("请输入有效的版本号（大于等于 1 的整数）");
      return;
    }

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/category-version", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version: versionNum }),
      });

      if (res.ok) {
        setCategoryVersion(versionNum);
        alert("版本号更新成功");
      } else {
        const errorData = await res.json();
        alert(`更新失败: ${errorData.error}`);
      }
    } catch (error) {
      console.error("更新版本号失败:", error);
      alert("更新版本号失败");
    }
  };

  const handleCreateCategory = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowAddForm(false);
        setFormData({ name: "", sort: 0, is_active: true });
        fetchData();
        alert("创建成功");
      }
    } catch (error) {
      console.error("创建失败:", error);
      alert("创建失败");
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/categories", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editingCategory.id,
          ...formData,
        }),
      });

      if (res.ok) {
        setEditingCategory(null);
        setFormData({ name: "", sort: 0, is_active: true });
        fetchData();
        alert("更新成功");
      }
    } catch (error) {
      console.error("更新失败:", error);
      alert("更新失败");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("确定要删除这个分类吗？")) return;

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`/api/admin-api/categories?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchData();
        alert("删除成功");
      }
    } catch (error) {
      console.error("删除失败:", error);
      alert("删除失败");
    }
  };

  const handleUpdateSubCategoryMapping = async (
    subCategoryId: number,
    categoryId: number,
  ) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/sub-categories-update-mapping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subCategoryId, categoryId }),
      });

      if (res.ok) {
        alert("映射更新成功");
        fetchData();
      }
    } catch (error) {
      console.error("更新映射失败:", error);
      alert("更新失败");
    }
  };

  const handleBatchUpdate = async () => {
    if (!selectedCategoryId) {
      alert("请先选择一级分类");
      return;
    }

    if (selectedSubCategoryIds.length === 0) {
      alert("请至少选择一个二级分类");
      return;
    }

    try {
      const token = localStorage.getItem("admin_token");
      
      // 先预览将要更新的视频
      const previewRes = await fetch(
        `/api/admin-api/preview-batch-update-category?categoryId=${selectedCategoryId}&subCategoryIds=${selectedSubCategoryIds.join(",")}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!previewRes.ok) {
        alert("预览失败");
        return;
      }

      const previewData = await previewRes.json();
      const { count, sampleVideos, tagNames } = previewData.data;

      if (count === 0) {
        alert("没有找到匹配的视频");
        return;
      }

      // 显示确认对话框
      const sampleNames = sampleVideos.slice(0, 3).map((v: any) => v.name).join("、");
      const confirmed = confirm(
        `即将更新 ${count} 个视频的分类为「${categories.find(c => c.id === selectedCategoryId)?.name}」\n` +
        `选中的标签：${tagNames.join("、")}\n` +
        `示例视频：${sampleNames}${sampleVideos.length > 3 ? "..." : ""}\n\n` +
        `确定要继续吗？`
      );

      if (!confirmed) return;

      // 执行批量更新
      const res = await fetch("/api/admin-api/videos/batch-update-category", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          subCategoryIds: selectedSubCategoryIds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`成功更新 ${data.data.count} 个视频`);
      } else {
        const errorData = await res.json();
        alert(`更新失败: ${errorData.error}`);
      }
    } catch (error) {
      console.error("批量更新失败:", error);
      alert("批量更新失败");
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      sort: category.sort,
      is_active: category.is_active,
    });
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setShowAddForm(false);
    setFormData({ name: "", sort: 0, is_active: true });
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">加载中...</div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => router.push("/admin")}
              className="text-indigo-600 hover:text-indigo-700"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">分类管理</h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 版本号管理 */}
          <div className="bg-white shadow rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    分类版本号
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    当前版本： <span className="font-bold text-indigo-600">{categoryVersion}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    任意分类（一级或二级）变化都会自动递增版本号，也可手动修改
                  </p>
                </div>
                <button
                  onClick={handleUpdateVersion}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  修改版本号
                </button>
              </div>
            </div>
          </div>

          {/* 一级分类 */}
          <div className="bg-white shadow rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  一级分类
                </h3>
                <button
                  onClick={() => {
                    setEditingCategory(null);
                    setFormData({ name: "", sort: 0, is_active: true });
                    setShowAddForm(!showAddForm);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {showAddForm ? "取消" : "添加分类"}
                </button>
              </div>

              {/* 添加/编辑表单 */}
              {showAddForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-md">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        分类名称
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="如：都市短剧"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        排序
                      </label>
                      <input
                        type="number"
                        value={formData.sort}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            sort: parseInt(e.target.value),
                          })
                        }
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={
                          editingCategory
                            ? handleUpdateCategory
                            : handleCreateCategory
                        }
                        className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        {editingCategory ? "更新" : "创建"}
                      </button>
                      {editingCategory && (
                        <button
                          onClick={handleCancelEdit}
                          className="ml-2 w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 分类列表 */}
              <div className="space-y-2">
                {/* 全部分类（虚拟分类） */}
                <div className="flex items-center justify-between p-3 border-2 border-dashed border-gray-300 rounded-md bg-gray-50">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700">全部分类</span>
                    <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      虚拟分类
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    显示所有视频（随机排序）
                  </span>
                </div>

                {/* 实际分类 */}
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <span className="font-medium">{cat.name}</span>
                      <span
                        className="ml-2 text-xs px-2 py-1 rounded ${
                        cat.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }"
                      >
                        {cat.is_active ? "启用" : "禁用"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        排序: {cat.sort}
                      </span>
                      <button
                        onClick={() => handleEditCategory(cat)}
                        className="text-indigo-600 hover:text-indigo-700 text-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 二级分类映射 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                批量更新视频分类
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                选择一级分类和二级分类标签，将包含这些标签的所有视频批量更新到指定的一级分类。
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择一级分类（目标分类）
                </label>
                <select
                  value={selectedCategoryId || ""}
                  onChange={(e) =>
                    setSelectedCategoryId(
                      e.target.value ? parseInt(e.target.value) : null,
                    )
                  }
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">请选择一级分类</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择二级分类标签（多选，用于筛选视频）
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2 border rounded-md">
                  {subCategories.map((sc) => (
                    <label
                      key={sc.id}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSubCategoryIds.includes(sc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubCategoryIds([...selectedSubCategoryIds, sc.id]);
                          } else {
                            setSelectedSubCategoryIds(
                              selectedSubCategoryIds.filter((id) => id !== sc.id),
                            );
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm">{sc.name}</span>
                      {sc.category_id && (
                        <span className="text-xs px-1 py-0.5 bg-gray-100 text-gray-600 rounded">
                          → {categories.find((c) => c.id === sc.category_id)?.name}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    已选择 {selectedSubCategoryIds.length} 个二级分类
                  </span>
                  <button
                    onClick={() => setSelectedSubCategoryIds([])}
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    清空选择
                  </button>
                </div>
              </div>

              <button
                onClick={handleBatchUpdate}
                disabled={!selectedCategoryId || selectedSubCategoryIds.length === 0}
                className={`w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 ${
                  !selectedCategoryId || selectedSubCategoryIds.length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                批量更新视频分类
              </button>
            </div>
          </div>

          {/* 二级分类映射管理 */}
          <div className="bg-white shadow rounded-lg mt-8">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                二级分类映射管理
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                将二级分类映射到一级分类，用于分类组织和管理（不影响视频显示逻辑）。
              </p>

              <div className="space-y-2">
                {subCategories.map((sc) => (
                  <div
                    key={sc.id}
                    className="flex items-center justify-between p-2 border rounded-md"
                  >
                    <span className="text-sm">{sc.name}</span>
                    <select
                      value={sc.category_id || ""}
                      onChange={(e) => {
                        const categoryId = e.target.value
                          ? parseInt(e.target.value)
                          : 0;
                        handleUpdateSubCategoryMapping(sc.id, categoryId);
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">未映射</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}