---
title: "LeetCode-热题100-3"
date: 2026-11-12
tags: ["LeetCode-热题100"]
summary: "leetcode第三题-最长连续序列-集合（哈希）"
---

# 给定一个未排序的整数数组 nums ，找出数字连续的最长序列（不要求序列元素在原数组中连续）的长度。
例如：
输入：nums = [100,4,200,1,3,2]
输出：4
解释：最长数字连续序列是 [1, 2, 3, 4]。它的长度为 4。
# 解法一（复杂度O（nlogn）暴力）
```
class Solution1(object):
    def longestConsecutive(self, nums):
        if not nums:
            return 0
        nums = sorted(set(nums))
        max_length = 1
        current_length = 1
        for i in range(1, len(nums)):
            if nums[i] == nums[i - 1] + 1:
                current_length += 1
            else:
                max_length = max(max_length, current_length)
                current_length = 1
        return max(max_length, current_length)
```
# 解法二（哈希集合）
利用集合可以哈希查找（O（1））
```
class Solution(object):
    def longestConsecutive(self, nums):
        max_length = 0
        s = set(nums)
        if not nums:
            return 0
        for i in s:
            if i-1 not in s:
                current_length = 1 #是一个连续序列的"最小元素"（起点）
                while i+1 in s: #哈希查找
                    i = i+1
                    current_length = current_length+1
                max_length = max(max_length,current_length)
        return max_length
```
# 要点解析
# 1.为什么使用集合
（1）可以哈希查找 时间复杂度低
（2）只需要寻找数量，不需要分组或者对应关系
（3）对于重复数字可以删除
# 2.set（nums）
去重、O(1) 查找、降低遍历规模
创建集合
```
# 1. 空集合（注意：{} 是空字典，不是空集合！）
s = set()

# 2. 从可迭代对象创建
s = set([1, 2, 3, 2, 1])      # {1, 2, 3}  自动去重
s = set("hello")               # {'h', 'e', 'l', 'o'}
s = set(range(5))              # {0, 1, 2, 3, 4}

# 3. 字面量创建
s = {1, 2, 3}
```
遍历与长度
```
s = {3, 1, 2}

for x in s:        # 遍历（顺序不保证）
    print(x)

len(s)             # 3
```
增删元素
```
s = {1, 2, 3}

s.add(4)          # 添加单个元素 → {1, 2, 3, 4}
s.add(1)          # 已存在，无变化

s.update([5, 6])  # 添加多个元素 → {1, 2, 3, 4, 5, 6}

s.remove(2)       # 删除，元素不存在会报 KeyError
s.discard(99)     # 删除，元素不存在也不报错（更安全）

x = s.pop()       # 随机弹出并返回一个元素
s.clear()         # 清空
```
# 3.哈希查找
可以哈希查找的结构：
dict 字典
set  集合
