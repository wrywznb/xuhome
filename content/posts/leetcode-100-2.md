---
title: "LeetCode-热题100-2"
date: 2026-11-11
tags: ["LeetCode-热题100"]
summary: "leetcode第二题-字母异位词分组-字典"
---

# 给你一个字符串数组，请你将 字母异位词 组合在一起。可以按任意顺序返回结果列表。

# 答案1：（运用字典）
```
class Solution(object):
    def groupAnagrams(self,strs):
        groups = {}
        for i in strs:
            key = "".join(sorted(i))
            if key not in groups:
                groups[key] = []
            groups[key].append(i)
        return list(groups.values())
```
# 答案2：（更简洁）
```
import collections
class Solution(object):
    def groupAnagrams(self, strs):
        groups = collections.defaultdict(list)
        for s in strs:
            groups[''.join(sorted(s))].append(s)
        return list(groups.values())
```

# 要点解析
# 1.字典（即哈希表）常见用法
```
d = {"a":1,"b":2} #创建字典
d = {}   d = dict() #空字典
d["a"]   d.get("a") #取值

# 增 / 改（key 存在就是改，不存在就是增）
例：d = {"a": 1}
d["b"] = 2               # 新增 {'a':1, 'b':2}
d["a"] = 100             # 修改 {'a':100, 'b':2}

# 删除
del d["a"]               # 删除指定 key，不存在会抛 KeyError
d.pop("b")               # 删除并返回 value，不存在抛 KeyError
d.clear()                # 清空整个字典

# 判断 key 是否存在
d = {"a": 1, "b": 2}
"a" in d          # True     —— 判断 key 是否存在（O(1)）
"x" not in d      # True

#遍历
d = {"a": 1, "b": 2}
# 1. 遍历 key（默认）
for k in d:
    print(k)                 # a, b

# 2. 遍历 value
for v in d.values():
    print(v)                 # 1, 2

# 3. 遍历键值对（最常用）
for k, v in d.items():
    print(k, v)              # a 1, b 2

# 获取所有 key / value / 键值对
d = {"a": 1, "b": 2}
d.keys()      # dict_keys(['a', 'b'])       —— 所有 key
d.values()    # dict_values([1, 2])          —— 所有 value
d.items()     # dict_items([('a',1),('b',2)])—— 所有键值对

# 它们返回的是"视图对象"，通常转成 list 使用
list(d.keys())    # ['a', 'b']
list(d.values())  # [1, 2]
list(d.items())   # [('a', 1), ('b', 2)]
```
# 2.defaultdict
defaultdict 是 collections 模块里的一个类，它是 dict 的子类，唯一区别是：
当你访问一个不存在的 key 时，它不会抛 KeyError，而是自动用一个默认值，并把这个 key 存进字典。
# 3.join
join 的硬性要求：元素必须是字符串
```
分隔符.join(可迭代对象)
"-".join(["a", "b", "c"])     # "a-b-c"
"".join(["a", "e", "t"])      # "aet"
"".join(sorted("eat"))        # sorted("eat") → ['a','e','t'] → "aet"
",".join(["1", "2", "3"])     # "1,2,3"
" ".join(["hello", "world"])  # "hello world"
"-".join(["2026", "11", "11"])# "2026-11-11"
```
