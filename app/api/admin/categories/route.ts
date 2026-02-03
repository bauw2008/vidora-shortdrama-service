import { NextResponse } from 'next/server';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/db/operations';
import { verifyAuth } from '@/lib/auth';

// GET - 获取所有一级分类
export async function GET(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const categories = await getCategories();

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取分类失败',
      },
      { status: 500 }
    );
  }
}

// POST - 创建一级分类
export async function POST(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, sort = 0 } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: '分类名称不能为空' },
        { status: 400 }
      );
    }

    const category = await createCategory({ name, sort, is_active: true });

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('创建分类失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建分类失败',
      },
      { status: 500 }
    );
  }
}

// PUT - 更新一级分类
export async function PUT(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, name, sort, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '分类ID不能为空' },
        { status: 400 }
      );
    }

    const category = await updateCategory(id, { name, sort, is_active });

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('更新分类失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '更新分类失败',
      },
      { status: 500 }
    );
  }
}

// DELETE - 删除一级分类
export async function DELETE(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '分类ID不能为空' },
        { status: 400 }
      );
    }

    await deleteCategory(id);

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除分类失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '删除分类失败',
      },
      { status: 500 }
    );
  }
}