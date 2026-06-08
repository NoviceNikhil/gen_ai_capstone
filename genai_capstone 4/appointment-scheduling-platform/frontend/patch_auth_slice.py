with open("src/store/authSlice.js", "r") as f:
    content = f.read()

thunk = """
export const deleteAccount = createAsyncThunk("auth/deleteAccount", async (_, { rejectWithValue, dispatch }) => {
  try {
    const res = await api.deleteAccountAPI();
    dispatch(logoutUser());
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: "Failed to delete account" });
  }
});

// ─── Initial State
"""
content = content.replace("// ─── Initial State", thunk.strip())

with open("src/store/authSlice.js", "w") as f:
    f.write(content)
