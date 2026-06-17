package com.deutschflow.curriculum.repository;

import com.deutschflow.curriculum.entity.TreeNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TreeNodeRepository extends JpaRepository<TreeNode, String> {

    /** All nodes for a set of topics, ordered within each topic by {@code order_index}. */
    List<TreeNode> findByTopicPkInOrderByTopicPkAscOrderIndexAsc(List<Long> topicPks);
}
