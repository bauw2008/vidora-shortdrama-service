const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getHeaders(useServiceRole = false) {
  const key = useServiceRole ? supabaseServiceRoleKey : supabaseKey;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  // 使用 service_role 时添加自定义 header 供 RLS 策略检查
  if (useServiceRole) {
    headers["X-Custom-Role"] = "admin";
  }

  return headers;
}

export async function select(table, options = {}) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required",
    );
  }

  const {
    columns = "*",
    filter = "",
    orderBy = "",
    limit = "",
    single = false,
  } = options;
  let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}`;

  if (filter) url += `&${filter}`;
  if (orderBy) url += `&order=${orderBy}`;
  if (limit) url += `&limit=${limit}`;
  if (single) url += "&limit=1";

  const response = await fetch(url, { headers: getHeaders() });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  const data = await response.json();
  return single ? data[0] || null : data;
}

export async function insert(table, data) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required",
    );
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  return response.json();
}

export async function update(table, data, filter) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required",
    );
  }

  let url = `${supabaseUrl}/rest/v1/${table}`;
  if (filter) url += `?${filter}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  return response.json();
}

export async function remove(table, filter) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required",
    );
  }

  const url = `${supabaseUrl}/rest/v1/${table}?${filter}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  return response.json();
}
