(module
  (memory (export "memory") 1)
  (global $heap_ptr (mut i32) (i32.const 4096))
  (global $free_head (mut i32) (i32.const 0))
  (func $__ensure_capacity (param $needed_end i32)
  (local $current_bytes i32) (local $required_pages i32)
    memory.size
    i32.const 65536
    i32.mul
    local.set $current_bytes
    local.get $needed_end
    local.get $current_bytes
    i32.gt_u
    if
      local.get $needed_end
      i32.const 65535
      i32.add
      i32.const 65536
      i32.div_u
      local.set $required_pages
      local.get $required_pages
      memory.size
      i32.sub
      memory.grow
      drop
    end
  )
  (func $alloc (param $size i32) (result i32)
  (local $aligned i32) (local $block i32) (local $prev i32) (local $curr i32) (local $curr_size i32) (local $next i32) (local $needed_end i32)
    local.get $size
    i32.const 7
    i32.add
    i32.const -8
    i32.and
    local.set $aligned
    local.get $aligned
    i32.eqz
    if
      i32.const 8
      local.set $aligned
    end
    i32.const 0
    local.set $prev
    global.get $free_head
    local.set $curr
    (block $search_done
      (loop $search
        local.get $curr
        i32.eqz
        br_if $search_done
        local.get $curr
        i32.load
        local.set $curr_size
        local.get $curr_size
        local.get $aligned
        i32.ge_u
        if
          local.get $curr
          i32.const 4
          i32.add
          i32.load
          local.set $next
          local.get $prev
          i32.eqz
          if
            local.get $next
            global.set $free_head
          else
            local.get $prev
            i32.const 4
            i32.add
            local.get $next
            i32.store
          end
          local.get $curr
          i32.const 8
          i32.add
          return
        end
        local.get $curr
        local.set $prev
        local.get $curr
        i32.const 4
        i32.add
        i32.load
        local.set $curr
        br $search
      )
    )
    global.get $heap_ptr
    local.set $block
    local.get $block
    i32.const 8
    i32.add
    local.get $aligned
    i32.add
    local.set $needed_end
    local.get $needed_end
    call $__ensure_capacity
    local.get $block
    local.get $aligned
    i32.store
    local.get $block
    i32.const 4
    i32.add
    i32.const 0
    i32.store
    local.get $needed_end
    global.set $heap_ptr
    local.get $block
    i32.const 8
    i32.add
  )
  (func $free (param $ptr i32)
  (local $block i32)
    local.get $ptr
    i32.eqz
    if
      return
    end
    local.get $ptr
    i32.const 8
    i32.sub
    local.set $block
    local.get $block
    i32.const 4
    i32.add
    global.get $free_head
    i32.store
    local.get $block
    global.set $free_head
  )
  (func $add (param $a i32) (param $b i32) (result i32)
  (local $__enum_tmp i32) (local $__tmp_i32 i32) (local $__tmp_i32_b i32) (local $__slice_obj i32) (local $__slice_start i32) (local $__slice_end i32) (local $__slice_count i32) (local $__slice_result i32) (local $__slice_idx i32)
    local.get $a
    local.get $b
    i32.add
    return
  )
  (func $multiply (param $a i32) (param $b i32) (result i32)
  (local $__enum_tmp i32) (local $__tmp_i32 i32) (local $__tmp_i32_b i32) (local $__slice_obj i32) (local $__slice_start i32) (local $__slice_end i32) (local $__slice_count i32) (local $__slice_result i32) (local $__slice_idx i32)
    local.get $a
    local.get $b
    i32.mul
    return
  )
  (func $factorial (param $n i32) (result i32)
  (local $__enum_tmp i32) (local $__tmp_i32 i32) (local $__tmp_i32_b i32) (local $__slice_obj i32) (local $__slice_start i32) (local $__slice_end i32) (local $__slice_count i32) (local $__slice_result i32) (local $__slice_idx i32) (local $result i32)
    i32.const 0
    local.set $result
    local.get $n
    i32.const 1
    i32.le_s
    if
      i32.const 1
      local.set $result
    else
      local.get $n
      local.get $n
      i32.const 1
      i32.sub
      call $factorial
      i32.mul
      local.set $result
    end
    local.get $result
    return
  )
  (func $fibonacci (param $n i32) (result i32)
  (local $__enum_tmp i32) (local $__tmp_i32 i32) (local $__tmp_i32_b i32) (local $__slice_obj i32) (local $__slice_start i32) (local $__slice_end i32) (local $__slice_count i32) (local $__slice_result i32) (local $__slice_idx i32) (local $result i32)
    i32.const 0
    local.set $result
    local.get $n
    i32.const 1
    i32.le_s
    if
      local.get $n
      local.set $result
    else
      local.get $n
      i32.const 1
      i32.sub
      call $fibonacci
      local.get $n
      i32.const 2
      i32.sub
      call $fibonacci
      i32.add
      local.set $result
    end
    local.get $result
    return
  )
  (func $main (result i32)
  (local $__enum_tmp i32) (local $__tmp_i32 i32) (local $__tmp_i32_b i32) (local $__slice_obj i32) (local $__slice_start i32) (local $__slice_end i32) (local $__slice_count i32) (local $__slice_result i32) (local $__slice_idx i32) (local $sum i32) (local $product i32) (local $fact i32) (local $fib i32)
    i32.const 10
    i32.const 20
    call $add
    local.set $sum
    i32.const 5
    i32.const 7
    call $multiply
    local.set $product
    i32.const 5
    call $factorial
    local.set $fact
    i32.const 10
    call $fibonacci
    local.set $fib
    local.get $sum
    local.get $product
    i32.add
    local.get $fact
    i32.add
    local.get $fib
    i32.add
    return
  )
  (export "add" (func $add))
  (export "multiply" (func $multiply))
  (export "factorial" (func $factorial))
  (export "fibonacci" (func $fibonacci))
  (export "main" (func $main))
  (export "__alloc" (func $alloc))
  (export "__free" (func $free))
)
