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
  (func $next (param $i i32) (result i32)
  (local $__enum_tmp i32) (local $__tmp_i32 i32) (local $__tmp_i32_b i32) (local $__slice_obj i32) (local $__slice_start i32) (local $__slice_end i32) (local $__slice_count i32) (local $__slice_result i32) (local $__slice_idx i32) (local $__enum_alloc_127 i32) (local $__enum_alloc_177 i32) (local $__enum_alloc_215 i32)
    local.get $i
    i32.const 3
    i32.lt_s
    if
      i32.const 16
      call $alloc
      local.tee $__enum_alloc_127
      i32.const 0
      i32.store
      local.get $__enum_alloc_127
      i32.const 8
      i32.add
      local.get $i
      i32.store
      local.get $__enum_alloc_127
      return
    else
      i32.const 8
      call $alloc
      local.tee $__enum_alloc_177
      i32.const 1
      i32.store
      local.get $__enum_alloc_177
      return
    end
    i32.const 8
    call $alloc
    local.tee $__enum_alloc_215
    i32.const 1
    i32.store
    local.get $__enum_alloc_215
    return
  )
  (func $main (result i32)
  (local $__enum_tmp i32) (local $__tmp_i32 i32) (local $__tmp_i32_b i32) (local $__slice_obj i32) (local $__slice_start i32) (local $__slice_end i32) (local $__slice_count i32) (local $__slice_result i32) (local $__slice_idx i32) (local $total i32) (local $i i32) (local $__for_end_301 i32) (local $w i32) (local $__whilelet_464 i32) (local $v i32) (local $branch i32) (local $__match_expr_576 i32) (local $__enum_alloc_582 i32)
    i32.const 0
    local.set $total
    i32.const 0
    local.set $i
    i32.const 3
    local.set $__for_end_301
    (block $for_exit_301
      (loop $for_loop_301
        local.get $i
        local.get $__for_end_301
        i32.gt_s
        br_if $for_exit_301
        local.get $total
        local.get $i
        i32.add
        local.set $total
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $for_loop_301
      )
    )
    i32.const 0
    local.set $w
    (block $while_exit_385
      (loop $while_loop_385
        local.get $w
        i32.const 2
        i32.lt_s
        i32.eqz
        br_if $while_exit_385
        local.get $w
        i32.const 1
        i32.add
        local.set $w
        br $while_loop_385
      )
    )
    i32.const 0
    local.set $i
    (block $whilelet_exit_464
      (loop $whilelet_loop_464
        local.get $i
        call $next
        local.set $__whilelet_464
        local.get $__whilelet_464
        i32.load
        i32.const 0
        i32.eq
        i32.const 1
        i32.and
        i32.eqz
        br_if $whilelet_exit_464
        local.get $__whilelet_464
        i32.const 8
        i32.add
        i32.load
        local.set $v
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        local.get $total
        local.get $v
        i32.add
        local.set $total
        br $whilelet_loop_464
      )
    )
    i32.const 16
    call $alloc
    local.tee $__enum_alloc_582
    i32.const 0
    i32.store
    local.get $__enum_alloc_582
    i32.const 8
    i32.add
    local.get $w
    i32.store
    local.get $__enum_alloc_582
    local.set $__match_expr_576
    (block $match_expr_end_576 (result i32)
      local.get $__match_expr_576
      i32.load
      i32.const 0
      i32.eq
      i32.const 1
      i32.and
      if (result i32)
        local.get $__match_expr_576
        i32.const 8
        i32.add
        i32.load
        local.set $v
        local.get $v
      else
        local.get $__match_expr_576
        i32.load
        i32.const 1
        i32.eq
        if (result i32)
          i32.const 0
        else
          unreachable
        end
      end
    )
    local.set $branch
    local.get $total
    local.get $branch
    i32.add
    return
  )
  (export "next" (func $next))
  (export "main" (func $main))
  (export "__alloc" (func $alloc))
  (export "__free" (func $free))
)
